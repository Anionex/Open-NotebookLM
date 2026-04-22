# MindMap Benchmark: MapReduce vs Original

- Papers judged: **18**
- Generator: `gemini-3-flash-preview` (汇云, full paper fed to both paths)
- Judge: `gemini-3-pro-preview` (aihubmix)
- Dimensions: Coverage, Hierarchy, Balance, Conciseness, Accuracy (1–5)

## Per-dimension mean ± std

| Dimension | MapReduce (mean ± std) | Original (mean ± std) | Δ (MR − OG) |
|-----------|------------------------|------------------------|-------------|
| coverage | 4.33 ± 0.67 | 4.72 ± 0.65 | -0.39 |
| hierarchy | 3.56 ± 0.76 | 4.83 ± 0.50 | -1.28 |
| balance | 4.06 ± 0.62 | 4.83 ± 0.37 | -0.78 |
| conciseness | 3.72 ± 0.73 | 4.50 ± 1.01 | -0.78 |
| accuracy | 4.00 ± 0.75 | 4.83 ± 0.37 | -0.83 |

**Sum of dims** — MapReduce: **19.67/25**, Original: **23.72/25** (Δ = -4.06)

## Paired wins per dimension

| Dimension | MR wins | OG wins | Tie |
|-----------|---------|---------|-----|
| coverage | 3 | 10 | 5 |
| hierarchy | 2 | 16 | 0 |
| balance | 3 | 14 | 1 |
| conciseness | 3 | 15 | 0 |
| accuracy | 3 | 13 | 2 |

**Overall paired result (sum of dims):** MapReduce 3 / Original 15 / Tie 0  (17% MR win-rate)

## Per-paper scores

| Paper | MR sum | OG sum | Δ | Winner |
|-------|--------|--------|---|--------|
| 01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents_... | 23 | 21 | +2 | MR |
| 03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models | 25 | 18 | +7 | MR |
| 05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey... | 17 | 25 | -8 | OG |
| 06_2302.10473v6_Oriented_object_detection_in_optical_remo... | 18 | 25 | -7 | OG |
| 07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey | 18 | 22 | -4 | OG |
| 08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Surv... | 21 | 25 | -4 | OG |
| 09_2509.16679v1_Reinforcement_Learning_Meets_Large_Langua... | 18 | 23 | -5 | OG |
| 10_2307.02140v3_Towards_Open_Federated_Learning_Platforms... | 17 | 25 | -8 | OG |
| 11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Er... | 17 | 25 | -8 | OG |
| 12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning | 20 | 25 | -5 | OG |
| 13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatia... | 25 | 18 | +7 | MR |
| 14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Larg... | 17 | 25 | -8 | OG |
| 15_2302.08893v4_Active_learning_for_data_streams__a_survey | 18 | 25 | -7 | OG |
| 16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Know... | 20 | 25 | -5 | OG |
| 17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_... | 23 | 25 | -2 | OG |
| 18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advance... | 17 | 25 | -8 | OG |
| 19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Su... | 19 | 25 | -6 | OG |
| 20_2204.10358v1_Creative_Problem_Solving_in_Artificially_... | 21 | 25 | -4 | OG |

## Strong wins (Δ ≥ 3)

- **OG** +8 on `05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey_of_Methods_and_Applications` (MR=17, OG=25)
- **OG** +8 on `10_2307.02140v3_Towards_Open_Federated_Learning_Platforms__Survey_and_Vision_from_Technical_and_Legal_Perspectives` (MR=17, OG=25)
- **OG** +8 on `11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Era__A_Survey` (MR=17, OG=25)
- **OG** +8 on `14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Large_Language_Models_and_Their_Applications_in_Scientific_Discovery` (MR=17, OG=25)
- **OG** +8 on `18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advances_in_Video_Frame_Interpolation` (MR=17, OG=25)
- **MR** +7 on `03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models` (MR=25, OG=18)
- **OG** +7 on `06_2302.10473v6_Oriented_object_detection_in_optical_remote_sensing_images_using_deep_learning__a_survey` (MR=18, OG=25)
- **MR** +7 on `13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatial_Dynamical_Systems_via_Linked_Entities` (MR=25, OG=18)
- **OG** +7 on `15_2302.08893v4_Active_learning_for_data_streams__a_survey` (MR=18, OG=25)
- **OG** +6 on `19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Supervised_Machine_Learning__A_Survey` (MR=19, OG=25)
- **OG** +5 on `09_2509.16679v1_Reinforcement_Learning_Meets_Large_Language_Models__A_Survey_of_Advancements_and_Applications_Across_the_LLM_Lifecycle` (MR=18, OG=23)
- **OG** +5 on `12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning` (MR=20, OG=25)
- **OG** +5 on `16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Knowledge_Graphs__A_Comprehensive_Survey` (MR=20, OG=25)
- **OG** +4 on `07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey` (MR=18, OG=22)
- **OG** +4 on `08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Survey_on_Multimodal_Retrieval-Augmented_Generation` (MR=21, OG=25)
- **OG** +4 on `20_2204.10358v1_Creative_Problem_Solving_in_Artificially_Intelligent_Agents__A_Survey_and_Framework` (MR=21, OG=25)
