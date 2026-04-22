# MindMap Benchmark: MapReduce vs Original

- Papers judged: **20**
- Generator: `DeepSeek-V3.1-Terminus` (aihubmix)
- Judge: `gemini-3-pro-preview` (aihubmix)
- Dimensions: Coverage, Hierarchy, Balance, Conciseness, Accuracy (1–5)

## Per-dimension mean ± std

| Dimension | MapReduce (mean ± std) | Original (mean ± std) | Δ (MR − OG) |
|-----------|------------------------|------------------------|-------------|
| coverage | 3.90 ± 0.83 | 4.15 ± 1.11 | -0.25 |
| hierarchy | 3.10 ± 0.89 | 4.50 ± 0.67 | -1.40 |
| balance | 3.40 ± 1.07 | 3.95 ± 1.24 | -0.55 |
| conciseness | 4.55 ± 0.59 | 3.50 ± 0.87 | +1.05 |
| accuracy | 3.85 ± 0.85 | 4.30 ± 1.05 | -0.45 |

**Sum of dims** — MapReduce: **18.80/25**, Original: **20.40/25** (Δ = -1.60)

## Paired wins per dimension

| Dimension | MR wins | OG wins | Tie |
|-----------|---------|---------|-----|
| coverage | 8 | 12 | 0 |
| hierarchy | 3 | 15 | 2 |
| balance | 6 | 14 | 0 |
| conciseness | 14 | 3 | 3 |
| accuracy | 6 | 11 | 3 |

**Overall paired result (sum of dims):** MapReduce 7 / Original 13 / Tie 0  (35% MR win-rate)

## Per-paper scores

| Paper | MR sum | OG sum | Δ | Winner |
|-------|--------|--------|---|--------|
| 01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents_... | 18 | 24 | -6 | OG |
| 02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Su... | 14 | 24 | -10 | OG |
| 03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models | 12 | 23 | -11 | OG |
| 04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview | 18 | 25 | -7 | OG |
| 05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey... | 20 | 22 | -2 | OG |
| 06_2302.10473v6_Oriented_object_detection_in_optical_remo... | 18 | 23 | -5 | OG |
| 07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey | 18 | 12 | +6 | MR |
| 08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Surv... | 18 | 24 | -6 | OG |
| 09_2509.16679v1_Reinforcement_Learning_Meets_Large_Langua... | 24 | 14 | +10 | MR |
| 10_2307.02140v3_Towards_Open_Federated_Learning_Platforms... | 15 | 23 | -8 | OG |
| 11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Er... | 15 | 24 | -9 | OG |
| 12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning | 21 | 22 | -1 | OG |
| 13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatia... | 20 | 24 | -4 | OG |
| 14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Larg... | 15 | 24 | -9 | OG |
| 15_2302.08893v4_Active_learning_for_data_streams__a_survey | 21 | 16 | +5 | MR |
| 16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Know... | 20 | 16 | +4 | MR |
| 17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_... | 24 | 18 | +6 | MR |
| 18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advance... | 16 | 20 | -4 | OG |
| 19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Su... | 25 | 18 | +7 | MR |
| 20_2204.10358v1_Creative_Problem_Solving_in_Artificially_... | 24 | 12 | +12 | MR |

## Strong wins (Δ ≥ 3)

- **MR** +12 on `20_2204.10358v1_Creative_Problem_Solving_in_Artificially_Intelligent_Agents__A_Survey_and_Framework` (MR=24, OG=12)
- **OG** +11 on `03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models` (MR=12, OG=23)
- **OG** +10 on `02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Survey_on_Large_Multimodal_Reasoning_Models` (MR=14, OG=24)
- **MR** +10 on `09_2509.16679v1_Reinforcement_Learning_Meets_Large_Language_Models__A_Survey_of_Advancements_and_Applications_Across_the_LLM_Lifecycle` (MR=24, OG=14)
- **OG** +9 on `11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Era__A_Survey` (MR=15, OG=24)
- **OG** +9 on `14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Large_Language_Models_and_Their_Applications_in_Scientific_Discovery` (MR=15, OG=24)
- **OG** +8 on `10_2307.02140v3_Towards_Open_Federated_Learning_Platforms__Survey_and_Vision_from_Technical_and_Legal_Perspectives` (MR=15, OG=23)
- **OG** +7 on `04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview` (MR=18, OG=25)
- **MR** +7 on `19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Supervised_Machine_Learning__A_Survey` (MR=25, OG=18)
- **OG** +6 on `01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents__A_Survey` (MR=18, OG=24)
- **MR** +6 on `07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey` (MR=18, OG=12)
- **OG** +6 on `08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Survey_on_Multimodal_Retrieval-Augmented_Generation` (MR=18, OG=24)
- **MR** +6 on `17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_the_Era_of_Large_Language_Models__A_Systematic_Survey` (MR=24, OG=18)
- **OG** +5 on `06_2302.10473v6_Oriented_object_detection_in_optical_remote_sensing_images_using_deep_learning__a_survey` (MR=18, OG=23)
- **MR** +5 on `15_2302.08893v4_Active_learning_for_data_streams__a_survey` (MR=21, OG=16)
- **OG** +4 on `13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatial_Dynamical_Systems_via_Linked_Entities` (MR=20, OG=24)
- **MR** +4 on `16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Knowledge_Graphs__A_Comprehensive_Survey` (MR=20, OG=16)
- **OG** +4 on `18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advances_in_Video_Frame_Interpolation` (MR=16, OG=20)
