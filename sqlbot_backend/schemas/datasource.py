"""
数据源相关的数据模型
"""
from typing import Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class DatasourceType(str, Enum):
    """数据源类型"""
    # SQL数据库
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLITE = "sqlite"
    SQLSERVER = "sqlserver"
    CLICKHOUSE = "clickhouse"
    ORACLE = "oracle"

    # 文件数据源
    CSV = "csv"
    EXCEL = "excel"
    PARQUET = "parquet"
    JSON = "json"

    # 搜索引擎
    ELASTICSEARCH = "elasticsearch"

    # API数据源
    REST_API = "rest_api"
    GRAPHQL = "graphql"


class DatasourceCreateRequest(BaseModel):
    """创建数据源请求"""
    name: str = Field(..., description="数据源名称")
    type: DatasourceType = Field(..., description="数据源类型")
    config: dict = Field(default_factory=dict, description="数据源配置")
    description: Optional[str] = None


class DatasourceResponse(BaseModel):
    """数据源响应"""
    id: int
    name: str
    type: DatasourceType
    config: dict
    description: Optional[str]
    created_at: datetime
    updated_at: datetime


class CSVUploadResponse(BaseModel):
    """CSV上传响应"""
    datasource_id: int
    filename: str
    filepath: str
    rows: int
    columns: int
    file_size: int
    preview: list = Field(default_factory=list, description="数据预览")


class DatasetPreview(BaseModel):
    """数据集预览"""
    datasource_id: int
    name: str
    rows: int
    columns: int
    column_names: list
    column_types: dict  # column_name -> dtype
    sample_data: list  # 前N行数据
