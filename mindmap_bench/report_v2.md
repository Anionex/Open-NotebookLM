# MindMap Benchmark: MapReduce vs Original

- Papers judged: **20**
- Generator: `qwen2.5-14b-Instruct-1m` (汇云, 1M context — full paper fed to both paths)
- Judge: `gemini-3-pro-preview` (aihubmix)
- Dimensions: Coverage, Hierarchy, Balance, Conciseness, Accuracy (1–5)

## Per-dimension mean ± std

| Dimension | MapReduce (mean ± std) | Original (mean ± std) | Δ (MR − OG) |
|-----------|------------------------|------------------------|-------------|
| coverage | 2.70 ± 0.84 | 4.35 ± 0.91 | -1.65 |
| hierarchy | 2.05 ± 0.86 | 4.10 ± 0.89 | -2.05 |
| balance | 2.35 ± 0.79 | 4.35 ± 0.65 | -2.00 |
| conciseness | 3.85 ± 0.79 | 3.35 ± 1.24 | +0.50 |
| accuracy | 2.95 ± 0.80 | 4.45 ± 0.80 | -1.50 |

**Sum of dims** — MapReduce: **13.90/25**, Original: **20.60/25** (Δ = -6.70)

## Paired wins per dimension

| Dimension | MR wins | OG wins | Tie |
|-----------|---------|---------|-----|
| coverage | 3 | 17 | 0 |
| hierarchy | 1 | 17 | 2 |
| balance | 1 | 19 | 0 |
| conciseness | 8 | 4 | 8 |
| accuracy | 1 | 17 | 2 |

**Overall paired result (sum of dims):** MapReduce 1 / Original 18 / Tie 1  (5% MR win-rate)

## Per-paper scores

| Paper | MR sum | OG sum | Δ | Winner |
|-------|--------|--------|---|--------|
| 01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents_... | 12 | 24 | -12 | OG |
| 02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Su... | 14 | 14 | +0 | tie |
| 03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models | 14 | 24 | -10 | OG |
| 04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview | 11 | 20 | -9 | OG |
| 05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey... | 10 | 25 | -15 | OG |
| 06_2302.10473v6_Oriented_object_detection_in_optical_remo... | 24 | 17 | +7 | MR |
| 07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey | 16 | 25 | -9 | OG |
| 08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Surv... | 15 | 21 | -6 | OG |
| 09_2509.16679v1_Reinforcement_Learning_Meets_Large_Langua... | 10 | 21 | -11 | OG |
| 10_2307.02140v3_Towards_Open_Federated_Learning_Platforms... | 13 | 18 | -5 | OG |
| 11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Er... | 12 | 18 | -6 | OG |
| 12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning | 12 | 21 | -9 | OG |
| 13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatia... | 17 | 20 | -3 | OG |
| 14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Larg... | 14 | 20 | -6 | OG |
| 15_2302.08893v4_Active_learning_for_data_streams__a_survey | 12 | 19 | -7 | OG |
| 16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Know... | 13 | 21 | -8 | OG |
| 17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_... | 15 | 20 | -5 | OG |
| 18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advance... | 14 | 24 | -10 | OG |
| 19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Su... | 15 | 16 | -1 | OG |
| 20_2204.10358v1_Creative_Problem_Solving_in_Artificially_... | 15 | 24 | -9 | OG |

## Strong wins (Δ ≥ 3)

- **OG** +15 on `05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey_of_Methods_and_Applications` (MR=10, OG=25)
- **OG** +12 on `01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents__A_Survey` (MR=12, OG=24)
- **OG** +11 on `09_2509.16679v1_Reinforcement_Learning_Meets_Large_Language_Models__A_Survey_of_Advancements_and_Applications_Across_the_LLM_Lifecycle` (MR=10, OG=21)
- **OG** +10 on `03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models` (MR=14, OG=24)
- **OG** +10 on `18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advances_in_Video_Frame_Interpolation` (MR=14, OG=24)
- **OG** +9 on `04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview` (MR=11, OG=20)
- **OG** +9 on `07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey` (MR=16, OG=25)
- **OG** +9 on `12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning` (MR=12, OG=21)
- **OG** +9 on `20_2204.10358v1_Creative_Problem_Solving_in_Artificially_Intelligent_Agents__A_Survey_and_Framework` (MR=15, OG=24)
- **OG** +8 on `16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Knowledge_Graphs__A_Comprehensive_Survey` (MR=13, OG=21)
- **MR** +7 on `06_2302.10473v6_Oriented_object_detection_in_optical_remote_sensing_images_using_deep_learning__a_survey` (MR=24, OG=17)
- **OG** +7 on `15_2302.08893v4_Active_learning_for_data_streams__a_survey` (MR=12, OG=19)
- **OG** +6 on `08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Survey_on_Multimodal_Retrieval-Augmented_Generation` (MR=15, OG=21)
- **OG** +6 on `11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Era__A_Survey` (MR=12, OG=18)
- **OG** +6 on `14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Large_Language_Models_and_Their_Applications_in_Scientific_Discovery` (MR=14, OG=20)
- **OG** +5 on `10_2307.02140v3_Towards_Open_Federated_Learning_Platforms__Survey_and_Vision_from_Technical_and_Legal_Perspectives` (MR=13, OG=18)
- **OG** +5 on `17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_the_Era_of_Large_Language_Models__A_Systematic_Survey` (MR=15, OG=20)
- **OG** +3 on `13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatial_Dynamical_Systems_via_Linked_Entities` (MR=17, OG=20)
