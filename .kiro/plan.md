# Code Refactoring Plan

## Overview
Comprehensive cleanup and reorganization of the codebase focusing on:
1. Environment variable configuration consolidation
2. Removal of unused dataflow_agent workflows and documentation
3. TTS adapter cleanup and verification

## Phase 1: Environment Variable Refactoring (Priority: High)

### Current State
- Root `.env`: 3 lines (Supabase config only)
- `fastapi_app/.env`: 72 lines (mixed infrastructure + model configs)
- Frontend: Hardcoded API URLs and model names
- Configuration scattered across multiple locations

### Target State
- Root `.env`: Infrastructure configs (Supabase, database, auth)
- `fastapi_app/.env.models`: Model-specific configs (API keys, model names, TTS settings)
- Frontend: Read from backend API config endpoint
- Clear separation of concerns

### Implementation Steps
1. Create `fastapi_app/.env.models` for model configurations
2. Move model-related vars from `fastapi_app/.env` to `.env.models`
3. Update `fastapi_app/config/settings.py` to load both files
4. Keep infrastructure vars in root `.env` and `fastapi_app/.env`
5. Update `.env.example` files accordingly

### Files to Modify
- `fastapi_app/.env` (split content)
- `fastapi_app/.env.example` (update structure)
- `fastapi_app/config/settings.py` (load multiple env files)
- `.env.example` (document infrastructure vars)

### Verification
- Backend starts without errors
- All model APIs accessible
- Frontend can fetch config from backend

## Phase 2: dataflow_agent Cleanup (Priority: Medium)

### Current State
- 23 workflows total in `dataflow_agent/workflow/`
- Only 3 actively used: `wf_intelligent_qa`, `wf_kb_mindmap`, `wf_kb_podcast`
- 16 unused workflows taking up space
- Docs contain irrelevant content from original repos

### Target State
- Keep only 3 active workflows
- Archive or delete 16 unused workflows
- Clean up docs to reflect actual functionality
- Clear workflow registry

### Workflows to Remove
1. `wf_arxiv_paper_search.py`
2. `wf_arxiv_paper_summary.py`
3. `wf_image2ppt.py`
4. `wf_paper2figure.py`
5. `wf_paper2ppt.py`
6. `wf_pdf2ppt.py`
7. `wf_ppt2polish.py`
8. `wf_web_search.py`
9. `wf_youtube_summary.py`
10. Plus 7 more unused workflows

### Docs to Clean
- Remove irrelevant documentation from merged repos
- Keep only: API docs, deployment guide, TTS setup guide
- Update README to reflect current features

### Implementation Steps
1. Identify all workflow references in codebase
2. Remove unused workflow files
3. Clean up `dataflow_agent/workflow/registry.py`
4. Remove irrelevant docs
5. Update main README

### Files to Delete
- 16 workflow files in `dataflow_agent/workflow/`
- Outdated docs in `docs/` directory
- Unused agent role definitions

### Verification
- Backend starts without import errors
- Only 3 workflows registered
- API endpoints work correctly

## Phase 3: TTS Adapter Cleanup (Priority: High)

### Current State
- 3 TTS managers: `qwen_tts_manager.py` ✓, `fireredtts_manager.py` ✓, `vibevoice_tts_manager.py` ✗
- MOSS-TTSD residue in cache and references
- Unclear which adapters are fully functional

### Target State
- Remove all MOSS-TTSD references
- Verify Qwen TTS works (already confirmed)
- Verify FireRed TTS works
- Remove or fix VibeVoice TTS
- Clean adapter selection logic

### Implementation Steps
1. Remove MOSS cache directory references
2. Remove MOSS imports from `req_tts.py`
3. Test Qwen TTS (already working)
4. Test FireRed TTS with sample text
5. Test VibeVoice TTS or remove if broken
6. Update `main.py` startup checks
7. Update `.env.example` with only working engines

### Files to Modify
- `dataflow_agent/toolkits/multimodaltool/req_tts.py` (remove MOSS logic)
- `fastapi_app/main.py` (remove MOSS checks)
- `fastapi_app/.env.example` (remove MOSS vars)

### Files to Delete
- MOSS cache directories (if any)
- `fastapi_app/vibevoice_tts_manager.py` (if not working)

### Verification
- Qwen TTS generates audio successfully
- FireRed TTS generates audio successfully
- No MOSS references in codebase
- TTS engine selection works correctly

## Phase 4: Integration Testing (Priority: High)

### Test Cases
1. Start backend with cleaned environment
2. Generate podcast with Qwen TTS (monologue mode)
3. Generate podcast with FireRed TTS (dialog mode if supported)
4. Generate mindmap from uploaded files
5. Run intelligent Q&A workflow
6. Verify frontend can access all features

### Success Criteria
- All 3 workflows execute without errors
- TTS audio generation works for both engines
- No import errors or missing dependencies
- Frontend displays correct configuration options

## Phase 5: Documentation Update (Priority: Low)

### Updates Needed
1. Update main README with current features
2. Document environment variable structure
3. Document TTS engine options and setup
4. Remove references to removed workflows
5. Add troubleshooting guide for common issues

### Files to Update
- `README.md` (main project readme)
- `README_ZH.md` (Chinese readme)
- `docs/SUPABASE_EMAIL_OTP_SETUP.md` (keep)
- `docs/SUPABASE_SIGNUP_OTP_FIX.md` (keep)

## Risk Assessment

### Low Risk
- Documentation updates
- Removing unused workflow files (not imported anywhere)

### Medium Risk
- Environment variable refactoring (requires careful migration)
- TTS adapter cleanup (need to verify alternatives work)

### Mitigation Strategies
- Create backup branch before starting
- Test each phase independently
- Keep `.env.backup` files during migration
- Verify backend starts after each phase

## Rollback Plan
1. Git stash or commit before each phase
2. Keep backup of original `.env` files
3. Document all changes in commit messages
4. Can revert individual phases if issues arise

## Estimated Timeline
- Phase 1: 1 day (environment refactoring)
- Phase 2: 2 days (workflow cleanup)
- Phase 3: 1 day (TTS cleanup)
- Phase 4: 0.5 day (integration testing)
- Phase 5: 0.5 day (documentation)
- **Total: 5 days**

## Dependencies
- No external dependencies required
- All changes are internal refactoring
- Existing functionality preserved

## Success Metrics
- Codebase size reduced by ~30%
- Clear separation of configuration layers
- All active features continue working
- Improved code maintainability
