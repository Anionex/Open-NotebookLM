# MindMap Benchmark: mapreduce vs original

- Papers judged: **20**
- Dimensions: Coverage, Hierarchy, Balance, Conciseness, Accuracy (1–5)

## Per-dimension mean ± std

| Dimension | mapreduce (mean ± std) | original (mean ± std) | Δ (MAPREDUCE − ORIGINAL) |
|-----------|------------------|------------------|------------------|
| coverage | 3.85 ± 0.65 | 4.00 ± 0.63 | -0.15 |
| hierarchy | 3.90 ± 0.62 | 4.25 ± 0.43 | -0.35 |
| balance | 3.95 ± 0.38 | 4.40 ± 0.49 | -0.45 |
| conciseness | 4.00 ± 0.32 | 4.20 ± 0.60 | -0.20 |
| accuracy | 3.10 ± 0.70 | 3.70 ± 0.71 | -0.60 |

**Sum of dims** — mapreduce: **18.80/25**, original: **20.55/25** (Δ = -1.75)

## Paired wins per dimension

| Dimension | mapreduce wins | original wins | Tie |
|-----------|---------|---------|-----|
| coverage | 7 | 8 | 5 |
| hierarchy | 3 | 10 | 7 |
| balance | 1 | 8 | 11 |
| conciseness | 2 | 6 | 12 |
| accuracy | 2 | 11 | 7 |

**Overall paired result (sum of dims):** mapreduce 7 / original 12 / Tie 1  (35% mapreduce win-rate)

## Per-paper scores

| Paper | mapreduce sum | original sum | Δ | Winner |
|-------|--------|--------|---|--------|
| 01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents_... | 19 | 18 | +1 | mapreduce |
| 02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Su... | 19 | 21 | -2 | original |
| 03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models | 18 | 17 | +1 | mapreduce |
| 04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview | 21 | 19 | +2 | mapreduce |
| 05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey... | 16 | 20 | -4 | original |
| 06_2302.10473v6_Oriented_object_detection_in_optical_remo... | 17 | 24 | -7 | original |
| 07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey | 19 | 23 | -4 | original |
| 08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Surv... | 21 | 22 | -1 | original |
| 09_2509.16679v1_Reinforcement_Learning_Meets_Large_Langua... | 17 | 21 | -4 | original |
| 10_2307.02140v3_Towards_Open_Federated_Learning_Platforms... | 17 | 22 | -5 | original |
| 11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Er... | 19 | 22 | -3 | original |
| 12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning | 17 | 23 | -6 | original |
| 13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatia... | 22 | 21 | +1 | mapreduce |
| 14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Larg... | 19 | 18 | +1 | mapreduce |
| 15_2302.08893v4_Active_learning_for_data_streams__a_survey | 19 | 19 | +0 | tie |
| 16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Know... | 17 | 20 | -3 | original |
| 17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_... | 19 | 23 | -4 | original |
| 18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advance... | 18 | 21 | -3 | original |
| 19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Su... | 20 | 17 | +3 | mapreduce |
| 20_2204.10358v1_Creative_Problem_Solving_in_Artificially_... | 22 | 20 | +2 | mapreduce |

## Strong wins (Δ ≥ 3)

- **original** +7 on `06_2302.10473v6_Oriented_object_detection_in_optical_remote_sensing_images_using_deep_learning__a_survey` (mapreduce=17, original=24)
- **original** +6 on `12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning` (mapreduce=17, original=23)
- **original** +5 on `10_2307.02140v3_Towards_Open_Federated_Learning_Platforms__Survey_and_Vision_from_Technical_and_Legal_Perspectives` (mapreduce=17, original=22)
- **original** +4 on `05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey_of_Methods_and_Applications` (mapreduce=16, original=20)
- **original** +4 on `07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey` (mapreduce=19, original=23)
- **original** +4 on `09_2509.16679v1_Reinforcement_Learning_Meets_Large_Language_Models__A_Survey_of_Advancements_and_Applications_Across_the_LLM_Lifecycle` (mapreduce=17, original=21)
- **original** +4 on `17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_the_Era_of_Large_Language_Models__A_Systematic_Survey` (mapreduce=19, original=23)
- **original** +3 on `11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Era__A_Survey` (mapreduce=19, original=22)
- **original** +3 on `16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Knowledge_Graphs__A_Comprehensive_Survey` (mapreduce=17, original=20)
- **original** +3 on `18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advances_in_Video_Frame_Interpolation` (mapreduce=18, original=21)
- **mapreduce** +3 on `19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Supervised_Machine_Learning__A_Survey` (mapreduce=20, original=17)
