# MindMap Benchmark: MapReduce vs Original

- Papers judged: **20**
- Generator: `gemini-3-flash-preview` (汇云, full paper fed to both paths)
- Judge: `gemini-3-pro-preview` (aihubmix)
- Dimensions: Coverage, Hierarchy, Balance, Conciseness, Accuracy (1–5)

## Per-dimension mean ± std

| Dimension | MapReduce (mean ± std) | Original (mean ± std) | Δ (MR − OG) |
|-----------|------------------------|------------------------|-------------|
| coverage | 4.30 ± 0.64 | 4.75 ± 0.43 | -0.45 |
| hierarchy | 3.50 ± 0.97 | 4.75 ± 0.54 | -1.25 |
| balance | 3.80 ± 0.75 | 4.80 ± 0.40 | -1.00 |
| conciseness | 3.90 ± 0.77 | 4.65 ± 0.65 | -0.75 |
| accuracy | 4.25 ± 0.70 | 4.85 ± 0.36 | -0.60 |

**Sum of dims** — MapReduce: **19.75/25**, Original: **23.80/25** (Δ = -4.05)

## Paired wins per dimension

| Dimension | MR wins | OG wins | Tie |
|-----------|---------|---------|-----|
| coverage | 5 | 12 | 3 |
| hierarchy | 4 | 16 | 0 |
| balance | 4 | 16 | 0 |
| conciseness | 4 | 15 | 1 |
| accuracy | 3 | 12 | 5 |

**Overall paired result (sum of dims):** MapReduce 4 / Original 16 / Tie 0  (20% MR win-rate)

## Per-paper scores

| Paper | MR sum | OG sum | Δ | Winner |
|-------|--------|--------|---|--------|
| 01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents_... | 25 | 19 | +6 | MR |
| 02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Su... | 22 | 25 | -3 | OG |
| 03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models | 20 | 25 | -5 | OG |
| 04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview | 16 | 25 | -9 | OG |
| 05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey... | 16 | 25 | -9 | OG |
| 06_2302.10473v6_Oriented_object_detection_in_optical_remo... | 17 | 25 | -8 | OG |
| 07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey | 18 | 25 | -7 | OG |
| 08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Surv... | 22 | 25 | -3 | OG |
| 09_2509.16679v1_Reinforcement_Learning_Meets_Large_Langua... | 14 | 23 | -9 | OG |
| 10_2307.02140v3_Towards_Open_Federated_Learning_Platforms... | 18 | 25 | -7 | OG |
| 11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Er... | 15 | 25 | -10 | OG |
| 12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning | 19 | 25 | -6 | OG |
| 13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatia... | 17 | 25 | -8 | OG |
| 14_2406.10833v3_A_Comprehensive_Survey_of_Scientific_Larg... | 22 | 24 | -2 | OG |
| 15_2302.08893v4_Active_learning_for_data_streams__a_survey | 21 | 25 | -4 | OG |
| 16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Know... | 25 | 20 | +5 | MR |
| 17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_... | 25 | 20 | +5 | MR |
| 18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advance... | 25 | 20 | +5 | MR |
| 19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Su... | 19 | 25 | -6 | OG |
| 20_2204.10358v1_Creative_Problem_Solving_in_Artificially_... | 19 | 25 | -6 | OG |

## Strong wins (Δ ≥ 3)

- **OG** +10 on `11_2408.12957v3_Image_Segmentation_in_Foundation_Model_Era__A_Survey` (MR=15, OG=25)
- **OG** +9 on `04_1701.07274v6_Deep_Reinforcement_Learning__An_Overview` (MR=16, OG=25)
- **OG** +9 on `05_2209.00796v15_Diffusion_Models__A_Comprehensive_Survey_of_Methods_and_Applications` (MR=16, OG=25)
- **OG** +9 on `09_2509.16679v1_Reinforcement_Learning_Meets_Large_Language_Models__A_Survey_of_Advancements_and_Applications_Across_the_LLM_Lifecycle` (MR=14, OG=23)
- **OG** +8 on `06_2302.10473v6_Oriented_object_detection_in_optical_remote_sensing_images_using_deep_learning__a_survey` (MR=17, OG=25)
- **OG** +8 on `13_2502.12128v5_LaM-SLidE_Latent_Space_Modeling_of_Spatial_Dynamical_Systems_via_Linked_Entities` (MR=17, OG=25)
- **OG** +7 on `07_1912.12033v2_Deep_Learning_for_3D_Point_Clouds__A_Survey` (MR=18, OG=25)
- **OG** +7 on `10_2307.02140v3_Towards_Open_Federated_Learning_Platforms__Survey_and_Vision_from_Technical_and_Legal_Perspectives` (MR=18, OG=25)
- **MR** +6 on `01_2411.18279v12_Large_Language_Model-Brained_GUI_Agents__A_Survey` (MR=25, OG=19)
- **OG** +6 on `12_2301.08028v4_A_Tutorial_on_Meta-Reinforcement_Learning` (MR=19, OG=25)
- **OG** +6 on `19_2201.12150v2_Learning_Curves_for_Decision_Making_in_Supervised_Machine_Learning__A_Survey` (MR=19, OG=25)
- **OG** +6 on `20_2204.10358v1_Creative_Problem_Solving_in_Artificially_Intelligent_Agents__A_Survey_and_Framework` (MR=19, OG=25)
- **OG** +5 on `03_2312.11562v5_A_Survey_of_Reasoning_with_Foundation_Models` (MR=20, OG=25)
- **MR** +5 on `16_2112.10006v6_Zero-shot_and_Few-shot_Learning_with_Knowledge_Graphs__A_Comprehensive_Survey` (MR=25, OG=20)
- **MR** +5 on `17_2412.06602v3_Towards_Controllable_Speech_Synthesis_in_the_Era_of_Large_Language_Models__A_Systematic_Survey` (MR=25, OG=20)
- **MR** +5 on `18_2506.01061v3_AceVFI__A_Comprehensive_Survey_of_Advances_in_Video_Frame_Interpolation` (MR=25, OG=20)
- **OG** +4 on `15_2302.08893v4_Active_learning_for_data_streams__a_survey` (MR=21, OG=25)
- **OG** +3 on `02_2505.04921v2_Perception__Reason__Think__and_Plan__A_Survey_on_Large_Multimodal_Reasoning_Models` (MR=22, OG=25)
- **OG** +3 on `08_2502.08826v3_Ask_in_Any_Modality__A_Comprehensive_Survey_on_Multimodal_Retrieval-Augmented_Generation` (MR=22, OG=25)
