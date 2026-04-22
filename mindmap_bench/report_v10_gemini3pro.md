# MindMap Benchmark: mapreduce vs original

- Papers judged: **20**
- Dimensions: Coverage, Hierarchy, Balance, Conciseness, Accuracy (1–5)

## Per-dimension mean ± std

| Dimension | mapreduce (mean ± std) | original (mean ± std) | Δ (MAPREDUCE − ORIGINAL) |
|-----------|------------------|------------------|------------------|
| coverage | 4.20 ± 0.75 | 4.50 ± 0.74 | -0.30 |
| hierarchy | 4.20 ± 0.87 | 4.60 ± 0.58 | -0.40 |
| balance | 4.75 ± 0.54 | 4.60 ± 0.49 | +0.15 |
| conciseness | 4.90 ± 0.30 | 3.75 ± 0.70 | +1.15 |
| accuracy | 4.75 ± 0.43 | 4.80 ± 0.40 | -0.05 |

**Sum of dims** — mapreduce: **22.80/25**, original: **22.25/25** (Δ = +0.55)

## Paired wins per dimension

| Dimension | mapreduce wins | original wins | Tie |
|-----------|---------|---------|-----|
| coverage | 6 | 10 | 4 |
| hierarchy | 7 | 11 | 2 |
| balance | 8 | 4 | 8 |
| conciseness | 17 | 0 | 3 |
| accuracy | 4 | 5 | 11 |

**Overall paired result (sum of dims):** mapreduce 12 / original 7 / Tie 1  (60% mapreduce win-rate)

## Per-paper scores

| Paper | mapreduce sum | original sum | Δ | Winner |
|-------|--------|--------|---|--------|
| 01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents_... | 23 | 24 | -1 | original |
| 02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Su... | 25 | 21 | +4 | mapreduce |
| 03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models | 25 | 17 | +8 | mapreduce |
| 04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview | 18 | 24 | -6 | original |
| 05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey... | 24 | 21 | +3 | mapreduce |
| 06_2302.10473v6_Oriented_object_detection_in_optical_remo... | 22 | 24 | -2 | original |
| 07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey | 22 | 21 | +1 | mapreduce |
| 08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Surv... | 23 | 23 | +0 | tie |
| 09_2509.16679v1_Reinforcement_Learning_Meets_Large_Langua... | 23 | 22 | +1 | mapreduce |
| 10_2307.02140v3_Towards_Open_Federated_Learning_Platforms... | 25 | 23 | +2 | mapreduce |
| 11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Er... | 16 | 24 | -8 | original |
| 12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning | 24 | 21 | +3 | mapreduce |
| 13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatia... | 25 | 24 | +1 | mapreduce |
| 14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Larg... | 23 | 21 | +2 | mapreduce |
| 15_2302.08893v4_Active_learning_for_data_streams__a_survey | 25 | 19 | +6 | mapreduce |
| 16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Know... | 25 | 21 | +4 | mapreduce |
| 17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_... | 25 | 23 | +2 | mapreduce |
| 18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advance... | 21 | 24 | -3 | original |
| 19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Su... | 23 | 24 | -1 | original |
| 20_2204.10358v1_Creative_Problem_Solving_in_Artificially_... | 19 | 24 | -5 | original |

## Strong wins (Δ ≥ 3)

- **mapreduce** +8 on `03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models` (mapreduce=25, original=17)
- **original** +8 on `11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Era__A_Survey` (mapreduce=16, original=24)
- **original** +6 on `04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview` (mapreduce=18, original=24)
- **mapreduce** +6 on `15_2302.08893v4_Active_learning_for_data_streams__a_survey` (mapreduce=25, original=19)
- **original** +5 on `20_2204.10358v1_Creative_Problem_Solving_in_Artificially_Intelligent_Agents__A_Survey_and_Framework` (mapreduce=19, original=24)
- **mapreduce** +4 on `02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Survey_on_Large_Multimodal_Reasoning_Models` (mapreduce=25, original=21)
- **mapreduce** +4 on `16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Knowledge_Graphs__A_Comprehensive_Survey` (mapreduce=25, original=21)
- **mapreduce** +3 on `05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey_of_Methods_and_Applications` (mapreduce=24, original=21)
- **mapreduce** +3 on `12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning` (mapreduce=24, original=21)
- **original** +3 on `18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advances_in_Video_Frame_Interpolation` (mapreduce=21, original=24)
