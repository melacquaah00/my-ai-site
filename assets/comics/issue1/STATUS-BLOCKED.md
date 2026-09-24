# Issue #1 v2 redraw — BLOCKED (executor)

## Blocker
`GenerateImage` (cursor native / GetDynamicTools) is **NOT available** to this executor subagent.

- GetMcpTools(server=cursor) → server not found (only cursor-github, user-Gmail, user-Link)
- CallMcpTool(cursor, GenerateImage) → "MCP server cursor is not available here"
- Same blocker documented previously in `/workspace/comic-ai/issue1/remake/STATUS.md`

## Reference locked on disk
`/workspace/soul-protocol/refs/official-duo-style.jpg`

## Target paths (empty / need overwrite)
- `/workspace/soul-protocol/issue1-pages-v2/page-01.png` … `page-10.png` (dir empty)
- `/workspace/my-ai-site/assets/comics/issue1/page-XX.png` (currently OLD 1280×720 landscape pages — wrong aspect + pre-lock style)

## Needed from parent
Call GenerateImage yourself with prompts in:
`/workspace/soul-protocol/issue1-v2-prompts/GENERATE_PROMPTS.md`

For each page:
1. GenerateImage(description=..., aspect_ratio="3:4", reference_image_paths=["/workspace/soul-protocol/refs/official-duo-style.jpg"], filename="issue1-v2-page-NN.png")
2. Read image to verify likeness; regenerate once if faces drift
3. mv/cp into both target paths above
4. Re-dispatch executor only for verify+copy if preferred

Do NOT publish to git from executor — parent pushes from PC.
