# MindMap Benchmark v10: mapreduce vs original

- Papers judged: **20**
- Dimensions: Coverage, Hierarchy, Balance, Conciseness, Accuracy (1–5)
- Judge: **gpt-5.4** via 汇云 (gemini-3-pro-preview was unavailable on the proxy; not directly comparable to v1–v9 reports)
- Generation: gemini-3-flash-preview via 汇云

## Per-dimension mean ± std

| Dimension | mapreduce (mean ± std) | original (mean ± std) | Δ (MAPREDUCE − ORIGINAL) |
|-----------|------------------|------------------|------------------|
| coverage | 4.15 ± 0.57 | 3.75 ± 0.62 | +0.40 |
| hierarchy | 4.10 ± 0.30 | 4.10 ± 0.30 | +0.00 |
| balance | 4.35 ± 0.48 | 4.15 ± 0.36 | +0.20 |
| conciseness | 4.55 ± 0.50 | 3.70 ± 0.56 | +0.85 |
| accuracy | 3.55 ± 0.80 | 3.60 ± 0.66 | -0.05 |

**Sum of dims** — mapreduce: **20.70/25**, original: **19.30/25** (Δ = +1.40)

## Paired wins per dimension

| Dimension | mapreduce wins | original wins | Tie |
|-----------|---------|---------|-----|
| coverage | 12 | 4 | 4 |
| hierarchy | 2 | 2 | 16 |
| balance | 6 | 2 | 12 |
| conciseness | 16 | 1 | 3 |
| accuracy | 6 | 5 | 9 |

**Overall paired result (sum of dims):** mapreduce 15 / original 3 / Tie 2  (75% mapreduce win-rate)

## Per-paper scores

| Paper | mapreduce sum | original sum | Δ | Winner |
|-------|--------|--------|---|--------|
| 01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents_... | 20 | 18 | +2 | mapreduce |
| 02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Su... | 21 | 18 | +3 | mapreduce |
| 03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models | 18 | 16 | +2 | mapreduce |
| 04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview | 17 | 19 | -2 | original |
| 05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey... | 22 | 18 | +4 | mapreduce |
| 06_2302.10473v6_Oriented_object_detection_in_optical_remo... | 24 | 20 | +4 | mapreduce |
| 07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey | 22 | 22 | +0 | tie |
| 08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Surv... | 20 | 18 | +2 | mapreduce |
| 09_2509.16679v1_Reinforcement_Learning_Meets_Large_Langua... | 23 | 20 | +3 | mapreduce |
| 10_2307.02140v3_Towards_Open_Federated_Learning_Platforms... | 20 | 20 | +0 | tie |
| 11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Er... | 21 | 20 | +1 | mapreduce |
| 12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning | 17 | 21 | -4 | original |
| 13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatia... | 22 | 20 | +2 | mapreduce |
| 14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Larg... | 19 | 17 | +2 | mapreduce |
| 15_2302.08893v4_Active_learning_for_data_streams__a_survey | 21 | 17 | +4 | mapreduce |
| 16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Know... | 22 | 20 | +2 | mapreduce |
| 17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_... | 21 | 18 | +3 | mapreduce |
| 18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advance... | 23 | 21 | +2 | mapreduce |
| 19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Su... | 21 | 19 | +2 | mapreduce |
| 20_2204.10358v1_Creative_Problem_Solving_in_Artificially_... | 20 | 24 | -4 | original |

## Strong wins (Δ ≥ 3)

- **mapreduce** +4 on `05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey_of_Methods_and_Applications` (mapreduce=22, original=18)
- **mapreduce** +4 on `06_2302.10473v6_Oriented_object_detection_in_optical_remote_sensing_images_using_deep_learning__a_survey` (mapreduce=24, original=20)
- **original** +4 on `12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning` (mapreduce=17, original=21)
- **mapreduce** +4 on `15_2302.08893v4_Active_learning_for_data_streams__a_survey` (mapreduce=21, original=17)
- **original** +4 on `20_2204.10358v1_Creative_Problem_Solving_in_Artificially_Intelligent_Agents__A_Survey_and_Framework` (mapreduce=20, original=24)
- **mapreduce** +3 on `02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Survey_on_Large_Multimodal_Reasoning_Models` (mapreduce=21, original=18)
- **mapreduce** +3 on `09_2509.16679v1_Reinforcement_Learning_Meets_Large_Language_Models__A_Survey_of_Advancements_and_Applications_Across_the_LLM_Lifecycle` (mapreduce=23, original=20)
- **mapreduce** +3 on `17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_the_Era_of_Large_Language_Models__A_Systematic_Survey` (mapreduce=21, original=18)
