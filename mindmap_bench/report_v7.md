# MindMap Benchmark: MapReduce vs Original

- Papers judged: **18**
- Generator: `gemini-3-flash-preview` (汇云, full paper fed to both paths)
- Judge: `gemini-3-pro-preview` (aihubmix)
- Dimensions: Coverage, Hierarchy, Balance, Conciseness, Accuracy (1–5)

## Per-dimension mean ± std

| Dimension | MapReduce (mean ± std) | Original (mean ± std) | Δ (MR − OG) |
|-----------|------------------------|------------------------|-------------|
| coverage | 4.17 ± 0.76 | 4.94 ± 0.23 | -0.78 |
| hierarchy | 3.56 ± 0.68 | 4.89 ± 0.46 | -1.33 |
| balance | 3.44 ± 0.76 | 5.00 ± 0.00 | -1.56 |
| conciseness | 3.56 ± 0.60 | 4.72 ± 0.73 | -1.17 |
| accuracy | 4.00 ± 0.67 | 4.94 ± 0.23 | -0.94 |

**Sum of dims** — MapReduce: **18.72/25**, Original: **24.50/25** (Δ = -5.78)

## Paired wins per dimension

| Dimension | MR wins | OG wins | Tie |
|-----------|---------|---------|-----|
| coverage | 1 | 11 | 6 |
| hierarchy | 1 | 17 | 0 |
| balance | 0 | 16 | 2 |
| conciseness | 1 | 15 | 2 |
| accuracy | 1 | 14 | 3 |

**Overall paired result (sum of dims):** MapReduce 1 / Original 17 / Tie 0  (6% MR win-rate)

## Per-paper scores

| Paper | MR sum | OG sum | Δ | Winner |
|-------|--------|--------|---|--------|
| 01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents_... | 24 | 20 | +4 | MR |
| 02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Su... | 18 | 25 | -7 | OG |
| 04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview | 21 | 25 | -4 | OG |
| 05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey... | 17 | 25 | -8 | OG |
| 06_2302.10473v6_Oriented_object_detection_in_optical_remo... | 20 | 25 | -5 | OG |
| 07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey | 21 | 22 | -1 | OG |
| 08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Surv... | 21 | 25 | -4 | OG |
| 09_2509.16679v1_Reinforcement_Learning_Meets_Large_Langua... | 18 | 25 | -7 | OG |
| 10_2307.02140v3_Towards_Open_Federated_Learning_Platforms... | 18 | 25 | -7 | OG |
| 11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Er... | 19 | 25 | -6 | OG |
| 12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning | 20 | 25 | -5 | OG |
| 13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatia... | 21 | 25 | -4 | OG |
| 14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Larg... | 15 | 25 | -10 | OG |
| 16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Know... | 16 | 25 | -9 | OG |
| 17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_... | 16 | 25 | -9 | OG |
| 18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advance... | 16 | 24 | -8 | OG |
| 19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Su... | 20 | 25 | -5 | OG |
| 20_2204.10358v1_Creative_Problem_Solving_in_Artificially_... | 16 | 25 | -9 | OG |

## Strong wins (Δ ≥ 3)

- **OG** +10 on `14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Large_Language_Models_and_Their_Applications_in_Scientific_Discovery` (MR=15, OG=25)
- **OG** +9 on `16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Knowledge_Graphs__A_Comprehensive_Survey` (MR=16, OG=25)
- **OG** +9 on `17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_the_Era_of_Large_Language_Models__A_Systematic_Survey` (MR=16, OG=25)
- **OG** +9 on `20_2204.10358v1_Creative_Problem_Solving_in_Artificially_Intelligent_Agents__A_Survey_and_Framework` (MR=16, OG=25)
- **OG** +8 on `05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey_of_Methods_and_Applications` (MR=17, OG=25)
- **OG** +8 on `18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advances_in_Video_Frame_Interpolation` (MR=16, OG=24)
- **OG** +7 on `02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Survey_on_Large_Multimodal_Reasoning_Models` (MR=18, OG=25)
- **OG** +7 on `09_2509.16679v1_Reinforcement_Learning_Meets_Large_Language_Models__A_Survey_of_Advancements_and_Applications_Across_the_LLM_Lifecycle` (MR=18, OG=25)
- **OG** +7 on `10_2307.02140v3_Towards_Open_Federated_Learning_Platforms__Survey_and_Vision_from_Technical_and_Legal_Perspectives` (MR=18, OG=25)
- **OG** +6 on `11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Era__A_Survey` (MR=19, OG=25)
- **OG** +5 on `06_2302.10473v6_Oriented_object_detection_in_optical_remote_sensing_images_using_deep_learning__a_survey` (MR=20, OG=25)
- **OG** +5 on `12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning` (MR=20, OG=25)
- **OG** +5 on `19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Supervised_Machine_Learning__A_Survey` (MR=20, OG=25)
- **MR** +4 on `01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents__A_Survey` (MR=24, OG=20)
- **OG** +4 on `04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview` (MR=21, OG=25)
- **OG** +4 on `08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Survey_on_Multimodal_Retrieval-Augmented_Generation` (MR=21, OG=25)
- **OG** +4 on `13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatial_Dynamical_Systems_via_Linked_Entities` (MR=21, OG=25)
