"""
Quiz 生成服务
从知识库文档中生成单选题测验
"""
import json
import re
import time
import httpx
from typing import List, Dict, Any
from pathlib import Path

from dataflow_agent.logger import get_logger
from fastapi_app.schemas import QuizQuestion, QuizOption

log = get_logger(__name__)


async def generate_quiz_with_llm(
    text_content: str,
    api_url: str,
    api_key: str,
    model: str,
    language: str,
    question_count: int,
) -> List[QuizQuestion]:
    """
    使用 LLM 从文本内容生成 Quiz 题目

    Args:
        text_content: 文档文本内容
        api_url: LLM API 地址
        api_key: API 密钥
        model: 模型名称
        language: 语言（zh/en）
        question_count: 生成题目数量

    Returns:
        Quiz 题目列表
    """
    # 限制文本长度，避免超出 token 限制
    max_chars = 10000
    if len(text_content) > max_chars:
        text_content = text_content[:max_chars] + "..."

    # 构建 Prompt
    prompt = _build_quiz_prompt(text_content, language, question_count)

    log.info(f"[quiz_service] 开始调用 LLM 生成 Quiz，模型: {model}, 数量: {question_count}")

    try:
        # 确保 API URL 包含完整路径
        if not api_url.endswith('/chat/completions'):
            if api_url.endswith('/'):
                api_url = api_url + 'chat/completions'
            else:
                api_url = api_url + '/chat/completions'

        # 调用 LLM API
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()

        # 解析 LLM 返回的内容
        content = result["choices"][0]["message"]["content"]
        questions = _parse_quiz_from_llm_response(content, question_count)

        log.info(f"[quiz_service] 成功生成 {len(questions)} 道题目")
        return questions

    except Exception as e:
        log.error(f"[quiz_service] LLM 调用失败: {e}")
        raise Exception(f"生成 Quiz 失败: {str(e)}")


def _build_quiz_prompt(text_content: str, language: str, question_count: int) -> str:
    """
    构建生成 Quiz 的 Prompt

    出题原则：
    1. 考察理解和应用，而非简单记忆
    2. 选项设计合理，干扰项有迷惑性
    3. 答案明确，有据可依
    4. 覆盖文档的关键知识点
    """
    if language == "zh":
        prompt = f"""请基于以下文档内容，生成 {question_count} 道高质量的单选题测验题目。

文档内容：
{text_content}

出题要求：
1. 题目类型：单选题，每题 4 个选项（A、B、C、D）
2. 考察理解和应用，题目清晰无歧义，干扰项有迷惑性
3. 难度分布：简单 30%、中等 50%、困难 20%
4. explanation 字段：1-2 句话简要说明正确答案的理由，不要逐个分析错误选项

请严格按以下 JSON 格式返回（不要添加额外字段）：
```json
[
  {{
    "id": "q1",
    "question": "题目内容",
    "options": [
      {{"label": "A", "text": "选项A"}},
      {{"label": "B", "text": "选项B"}},
      {{"label": "C", "text": "选项C"}},
      {{"label": "D", "text": "选项D"}}
    ],
    "correct_answer": "A",
    "explanation": "简短解释（1-2句话）"
  }}
]
```

请确保返回完整、有效的 JSON。"""
    else:
        prompt = f"""Based on the following document content, generate {question_count} high-quality multiple-choice quiz questions.

Document Content:
{text_content}

Requirements:
1. Question Type: Multiple choice, each question must have exactly 4 options (A, B, C, D)
2. Test understanding and application, not just memorization. Clear and unambiguous.
3. Difficulty Distribution: Easy 30%, Medium 50%, Hard 20%
4. explanation field: 1-2 sentences briefly explaining why the answer is correct. Do NOT analyze each wrong option.

Return strictly in this JSON format (no extra fields):
```json
[
  {{
    "id": "q1",
    "question": "Question text",
    "options": [
      {{"label": "A", "text": "Option A"}},
      {{"label": "B", "text": "Option B"}},
      {{"label": "C", "text": "Option C"}},
      {{"label": "D", "text": "Option D"}}
    ],
    "correct_answer": "A",
    "explanation": "Brief explanation (1-2 sentences)"
  }}
]
```

Ensure the response is complete, valid JSON."""

    return prompt


def _try_parse_json_array(json_str: str):
    """尝试解析 JSON 数组，失败时逐步回退到最后一个完整对象"""
    # 先直接尝试
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass

    # 找所有顶层 '}' 的位置（每个代表一个 question 对象的结尾）
    # 从后往前逐个尝试截断 + 闭合
    brace_depth = 0
    bracket_depth = 0
    in_string = False
    escape = False
    candidates = []
    for i, ch in enumerate(json_str):
        if escape:
            escape = False
            continue
        if ch == '\\' and in_string:
            escape = True
            continue
        if ch == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            brace_depth += 1
        elif ch == '}':
            brace_depth -= 1
            if brace_depth == 0:
                candidates.append(i)
        elif ch == '[':
            bracket_depth += 1
        elif ch == ']':
            bracket_depth -= 1

    # 从最后一个完整对象往前尝试
    for pos in reversed(candidates):
        attempt = json_str[:pos + 1] + ']'
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            continue

    raise json.JSONDecodeError("No valid JSON array found", json_str, 0)


def _parse_quiz_from_llm_response(content: str, question_count: int) -> List[QuizQuestion]:
    """
    从 LLM 返回的内容中解析 Quiz 题目
    """
    try:
        # 尝试提取 JSON（可能包含在 markdown 代码块中）
        # 用贪婪匹配，因为内容可能被截断没有闭合的 ```
        json_match = re.search(r'```(?:json)?\s*(\[[\s\S]*)', content)
        if json_match:
            json_str = json_match.group(1)
            # 去掉尾部可能的 ```
            json_str = re.sub(r'\s*```\s*$', '', json_str)
        else:
            json_str = content.strip()

        questions_data = _try_parse_json_array(json_str)

        # 转换为 QuizQuestion 对象
        questions = []
        for i, q_data in enumerate(questions_data[:question_count]):
            options = []
            for opt in q_data.get("options", [])[:4]:
                options.append(QuizOption(
                    label=opt.get("label", ""),
                    text=opt.get("text", "")
                ))
            while len(options) < 4:
                label = chr(65 + len(options))
                options.append(QuizOption(label=label, text=""))

            question = QuizQuestion(
                id=q_data.get("id", f"q{i+1}"),
                question=q_data.get("question", ""),
                options=options,
                correct_answer=q_data.get("correct_answer", "A"),
                explanation=q_data.get("explanation", ""),
            )
            questions.append(question)

        if not questions:
            raise Exception("解析后题目列表为空")

        log.info(f"[quiz_service] 成功解析 {len(questions)} 道题目（请求 {question_count} 道）")
        return questions

    except Exception as e:
        log.error(f"[quiz_service] 解析 Quiz 失败: {e}")
        log.error(f"[quiz_service] LLM 返回内容: {content[:500]}")
        raise Exception(f"解析 Quiz 失败: {str(e)}")

