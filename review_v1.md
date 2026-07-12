Kết luận thẳng

Đây là một nền tảng agent có kiến trúc nghiêm túc, không phải dự án “vẽ UI rồi gắn tên AI”. Phần agent loop, tool policy, approval, MCP, knowledge retrieval, checkpoint, tracing và workflow đều đã có implementation tương đối rõ ràng.

Nhưng hiện tại dự án chưa thể gọi là production-ready, và đặc biệt:

“Safe Optimizer” hiện gần như chưa tối ưu được gì trong thực tế.
“Skill Learning” hiện là đóng gói chuỗi tên tool, chưa phải học kỹ năng.
Có vài lỗ hổng bảo mật cấp hệ thống liên quan đến sandbox, filesystem và Electron IPC.
Tài liệu kiến trúc mô tả chuẩn tốt hơn những gì code hiện tại thực sự tuân thủ.

Đánh giá tổng thể của tôi: 6,2/10 cho một alpha kỹ thuật mạnh; khoảng 4/10 nếu định phát hành cho người dùng chạy trên repository thật.

Review này dựa trên bản Repomix gồm 288 file entries; một số phần như public, workflow GitHub, package lock, binary và một số script không có trong gói nên tôi chưa thể xác nhận build, CSP, supply-chain hoặc release pipeline thực tế.

Chấm điểm theo từng lớp
Hạng mục	Điểm	Nhận xét
Ý tưởng và phạm vi sản phẩm	8/10	Tham vọng đúng hướng: agent runtime + knowledge + MCP + observability + evaluation
Kiến trúc backend Electron	7,5/10	Domain/port/use-case/infrastructure được tách tương đối thật
Agent runtime	6,5/10	Có multi-step, checkpoint, compaction, approval, tracing
Knowledge/RAG	7/10	Là phần trưởng thành nhất sau core runtime
Workflow	6,5/10	Deterministic, có retry/checkpoint/approval, nhưng còn hạn chế
Bảo mật	4/10	Có tư duy security, nhưng còn lỗi sandbox/filesystem nghiêm trọng
Evaluation	2,5/10	Evaluator có, nhưng chưa chạy agent thật
Safe Optimizer	2/10	Pipeline quản lý candidate tốt, tín hiệu đánh giá không có giá trị thực
Skill Learning	3/10	Quy trình ký/duyệt tốt, nội dung “học” quá nghèo
Test và khả năng vận hành	5/10	Có nhiều unit test nhưng thiếu integration/E2E ở nơi nguy hiểm nhất
Những điểm làm tốt
1. Kiến trúc không chỉ nằm trên giấy

Main process đã được tách thành:

domain/entities
domain/ports
application/usecases
infrastructure
ipc

electron/main.ts hiện chủ yếu làm bootstrap và đăng ký IPC, thay vì là file chúa vài trăm dòng như tài liệu cũ mô tả. Agent provider, tool executor, approval manager, task repository, tracer và MCP gateway đều được inject qua interface tương đối sạch.

Đây là điểm rất đáng giá: sau này có thể thay provider, storage, evaluator hoặc tool backend mà không phải viết lại toàn bộ agent loop.

2. Central tool policy được thiết kế đúng hướng

Tool có risk classification:

read
write
execute
network

read-only chặn tool không phải read; workspace-write yêu cầu approval cho các hành động có rủi ro; danger-full-access cho chạy tự động.

Đặc biệt, MCP tool cũng đi qua cùng pipeline policy, approval và audit thay vì tạo một “đường tắt”. Đây là quyết định thiết kế đúng.

3. Agent runtime có nền tảng thực tế

RunAgentSession đã xử lý được:

Nhiều vòng model → tool → model.
Giới hạn bước cho mỗi lần chạy và toàn task.
Pause/resume qua durable checkpoint.
Abort bằng AbortSignal.
Context compaction.
Attachment formatting.
Knowledge context và skill context.
Trace model call/tool call/approval.
Recovery task bị gián đoạn khi ứng dụng đóng.

Đây là core đủ tốt để tiếp tục phát triển, không cần đập bỏ viết lại.

4. Knowledge retrieval là phần có chất lượng

Phần knowledge có:

Chunk code TypeScript/JavaScript bằng AST.
Fallback cho text và ngôn ngữ khác.
BM25 lexical retrieval.
Cosine semantic retrieval.
Rank fusion.
Diversification để giảm chunk trùng.
Embedding profile/version để tránh trộn vector không tương thích.
Recall@K, Precision@K, MRR, nDCG và percentile latency.

So với nhiều dự án agent chỉ nhét vector search vào rồi gọi là RAG, phần này có tư duy đánh giá và versioning tốt hơn đáng kể.

5. Observability chú trọng quyền riêng tư

Trace schema cố tình không giữ:

Prompt.
API key.
Tool arguments.
Tool output.
File content.
Provider URL.

Tool/approval span vẫn giữ linkage task, request, step và parent span. Đây là trade-off hợp lý giữa quan sát hành vi và tránh biến log thành kho dữ liệu nhạy cảm.

6. Skill promotion có chuỗi tin cậy tương đối tốt

Dù “học” còn yếu, pipeline an toàn lại khá chắc:

Chỉ nhận trace thành công.
Candidate immutable khi evaluate.
Bắt buộc evaluation pass.
Bắt buộc người dùng approve.
Ký file skill bằng local key.
Catalog phát hiện skill bị sửa sau khi ký.
Skill được promote vẫn chưa tự động trusted/enabled.
Skill không được phép vượt central tool policy.

Tức là tác giả dự án có hiểu nguy cơ self-modifying agent.

Các vấn đề nghiêm trọng
P0 — Evaluation hiện không đánh giá agent thật

Đây là vấn đề lớn nhất về tính đúng đắn của sản phẩm.

GOLDEN_AGENT_SUITE chứa sẵn cả:

expected
observed

Ví dụ fixture đã khai báo sẵn agent gọi read_file, apply_patch, hoàn thành trong hai bước và test pass. Evaluator chỉ so sánh hai object tĩnh này.

Nó không:

Khởi chạy model.
Tạo workspace fixture.
Cho agent thực thi task.
Quan sát tool calls thật.
Chạy test thật.
Đọc git diff thật.
Đo kết quả dưới optimizer config đang thử nghiệm.

Vì fixture đã chứa kết quả đúng, các lần chạy evaluation gần như luôn tạo score giống nhau. Test cũng khẳng định các evaluator đều đạt score 1.

Hệ quả trực tiếp: Safe Optimizer không có tín hiệu để tối ưu.

AgentReportOptimizationEvaluator chỉ lấy:

candidate.aggregateScore - baseline.aggregateScore

Trong khi baseline và candidate cùng đánh giá lại các object observed tĩnh. Bình thường cả hai đều đạt 1, improvement bằng 0, candidate bị từ chối vì không đạt mức cải thiện 0.001.

Nói cách khác:

Optimizer có state machine, provenance, rollback và allowlist khá đẹp, nhưng động cơ đo lường phía dưới chưa được nối vào agent thật.

Đây là “evaluation framework”, chưa phải “agent evaluation system”.

Cách sửa đúng

Golden fixture chỉ nên chứa:

{
  prompt,
  workspaceFixture,
  permissionMode,
  expectedChangedFiles,
  forbiddenTools,
  expectedAssertions,
  testCommand,
  maxSteps
}

Một evaluation runner cần:

Copy fixture repository vào temporary workspace.
Chạy agent thật với config baseline.
Thu trace/tool calls/diff/test result.
Chạy lại trong workspace sạch với candidate config.
Sinh observed từ kết quả thật.
Ràng buộc report với:
config digest
model ID
agent commit/build version
fixture version
random seed hoặc sampling parameters
So sánh theo từng fixture, không chỉ aggregate score.

Tốt hơn nữa, API optimizer không nên cho người dùng nhập tùy ý hai run ID. Optimizer phải tự khởi chạy paired evaluation và giữ provenance của hai run.

P0 — Timeout của process đang có bug logic

Trong spawnAndCollect, khi timeout:

settled = true;
child.kill('SIGTERM');
killFallback(5_000);
resolve(...);

Nhưng fallback lại làm:

if (!settled) child.kill('SIGKILL');

Do settled đã là true, SIGKILL fallback sẽ không bao giờ chạy.

Ngoài ra, code chỉ kill shell process. Lệnh có thể tạo child process hoặc daemon; các process con có thể tiếp tục chạy sau khi tool đã báo timeout.

Điều này đặc biệt nguy hiểm với:

Build treo.
Script spawn server.
Fork bomb nhỏ.
Process giữ file lock.
Command tiếp tục sửa filesystem sau khi UI đã báo thất bại.
Cách sửa

Tách hai trạng thái:

let resolved = false;
let exited = false;

Khi timeout:

Gửi SIGTERM cho process group.
Chưa coi process là đã exit.
Sau 5 giây gửi SIGKILL nếu chưa exit.
Chỉ cleanup timer khi nhận close.
Trên Windows dùng Job Object hoặc taskkill /PID ... /T /F.
Trên POSIX spawn process group riêng và kill cả group.

Phải có integration test chạy một command cố tình bỏ qua SIGTERM và spawn child process.

P0 — Kiểm tra path chưa chống được symlink escape

resolveSafePath chỉ dùng:

path.resolve(...)
path.relative(...)

Nó chặn được ../, nhưng không chặn được tình huống:

workspace/link -> /home/user/.ssh
read_file("link/id_rsa")

fs.stat và fs.readFile sẽ follow symlink. Kết quả là read_file, write_file và apply_patch có thể thoát khỏi workspace dù path dạng chữ vẫn nằm bên trong workspace.

Knowledge scanner có bỏ qua symlink khi scan tự động, nhưng filesystem tool không làm vậy.

Cách sửa
realpath() workspace root.
Với read: lstat() từng segment hoặc realpath() file rồi kiểm tra lại dưới root.
Với write file chưa tồn tại: realpath nearest existing parent rồi xác minh.
Mặc định từ chối symbolic link cho agent tools.
Dùng O_NOFOLLOW khi hệ điều hành hỗ trợ.
Ghi file atomically qua temporary file + rename.
Thêm test symlink cho read, write và patch.
P0/P1 — Electron security boundary chưa đủ chặt

Main window đang dùng:

contextIsolation: true
nodeIntegration: false
sandbox: false

contextIsolation và nodeIntegration: false là tốt, nhưng renderer sandbox lại bị tắt.

Ngoài ra ExternalNavigationPolicy chỉ xử lý:

setWindowOpenHandler(...)

Nó không chặn same-window navigation bằng will-navigate. Nếu một trang không tin cậy được load vào BrowserWindow chính, preload có thể tiếp tục expose window.agentStudio.

Preload hiện expose cả:

Tạo terminal.
Gửi dữ liệu vào terminal.
Ghi file workspace.
Thiết lập MCP server.
Bắt đầu agent.
Thay đổi provider.
Thay đổi permission mode.

Terminal IPC không đi qua agent tool approval. Đây là hợp lý khi UI đáng tin cậy, nhưng trở thành RCE nếu renderer hoặc navigation boundary bị compromise.

Hiện UI React render model output dưới dạng text nên chưa thấy XSS trực tiếp. Tuy nhiên Electron app có quyền chạy shell cần phòng thủ theo nguyên tắc “renderer sẽ có ngày bị compromise”.

Cần bổ sung
Bật sandbox: true nếu preload không có dependency buộc phải tắt.
Chặn will-navigate trừ URL ứng dụng hiện tại.
Chặn attach webview.
Kiểm tra event.senderFrame.url hoặc origin cho IPC nhạy cảm.
Không để bất kỳ remote origin nào dùng preload quyền cao.
Tách terminal bridge khỏi bridge agent thông thường nếu có thể.
Dùng CSP nghiêm ngặt trong index.html.
Không cấp permission browser mặc định.
Viết một security integration test cho navigation/preload.
“Self-learning” hiện mới là tên gọi

generateSkillCandidate() lấy các span tool thành công, sort theo step, sau đó chuyển thành:

[...new Set(toolNames)]

Rồi sinh hướng dẫn kiểu:

1. Consider the `read_file` capability...
2. Consider the `apply_patch` capability...

Thông tin bị loại bỏ gồm:

Mục tiêu của task.
Điều kiện để dùng skill.
Tool lặp lại bao nhiêu lần.
Quan hệ giữa output tool trước và input tool sau.
Cấu trúc argument.
Branch.
Error recovery.
Validation đã thực hiện.
File pattern hoặc loại dự án.
Lý do trajectory thành công.

Việc dùng Set còn làm mất các sequence quan trọng như:

read → patch → test → patch → test

thành:

read → patch → test

Evaluator skill hiện chỉ kiểm tra:

Trace nguồn thành công.
Tên tool có xuất hiện trong instructions.
Instructions dưới 20.000 ký tự.
Không chứa vài từ khóa bypass policy.

Do vậy candidate gần như chắc chắn pass miễn là nó được generator tạo ra.

Đây chưa phải learning. Nó là:

Tạo một playbook chung chung từ danh sách tên tool, sau đó ký và đưa qua quy trình phê duyệt.

Phần signing/promotion là tốt; phần extraction và evaluation chưa đủ giá trị.

Để trở thành học kỹ năng thực sự

Một learned skill tối thiểu cần biểu diễn:

{
  intentPatterns,
  preconditions,
  orderedSteps,
  repeatedSteps,
  parameterTemplates,
  outputBindings,
  successAssertions,
  failureRecovery,
  sourceTraceIds,
  confidence,
  evaluationCorpus
}

Ví dụ:

Khi sửa TypeScript:
1. Đọc file liên quan.
2. Xác định block duy nhất cần thay.
3. Dùng apply_patch thay vì write_file toàn bộ file.
4. Chạy đúng test package.
5. Nếu test fail do type error, đọc vị trí lỗi và patch lại.
6. Không promote nếu chưa vượt baseline trên ít nhất N task tương tự.

Candidate cần được replay trên nhiều fixture độc lập, không chỉ kiểm tra chính nội dung của candidate.

Safe Optimizer chưa phải optimizer

Hiện tại người dùng tự tạo candidate, ví dụ tăng retrievalTopK từ 5 lên 6. Hệ thống không tự:

Đề xuất candidate.
Chọn parameter.
Chạy experiment.
Phân tích trace.
Phân cụm failure.
Tính chi phí/token.
Kiểm tra regression theo từng nhóm task.
Tìm Pareto frontier giữa chất lượng, chi phí và latency.

Những gì hiện có thực chất là:

Config registry có revision, candidate, evaluation gate, promotion và rollback.

Đây là phần control plane của optimizer, không phải optimization engine.

Ngoài ra chỉ so aggregate score là nguy hiểm. Candidate có thể tăng retrieval score nhưng làm hỏng policy hoặc tăng chi phí gấp mười lần. Cần gate đa mục tiêu:

task success không giảm
policy violations = 0
p95 latency không vượt ngưỡng
token cost không tăng quá X%
changed-file precision không giảm
aggregate score tăng có ý nghĩa thống kê
Các vấn đề bảo mật và dữ liệu khác
1. macOS sandbox cho đọc toàn bộ filesystem

Seatbelt profile có:

(allow file-read*)

Tức là command trong workspace-write không được ghi ngoài workspace, nhưng vẫn có thể đọc:

SSH key.
Dotfiles.
Browser data mà process có quyền đọc.
Source code ngoài workspace.
Config chứa token.

Network trong sandbox có thể bị chặn, nhưng stdout được gửi ngược cho model qua tool result. Vì vậy dữ liệu vẫn có thể bị exfiltrate tới AI provider thông qua chính agent loop.

Tên workspace-write dễ khiến người dùng hiểu nhầm là mọi quyền đều bị giới hạn trong workspace. Thực tế chỉ phần write được giới hạn.

Nên đổi semantics thành:

workspace-read-write: chỉ đọc/ghi workspace.
host-read-workspace-write: nếu thực sự cần và phải cảnh báo rõ.
danger-full-access.
2. Dữ liệu nhạy cảm được lưu với permission mặc định

Các repository sau ghi full content nhưng không thấy đặt mode: 0o600:

agent-tasks.json
Chat history.
Knowledge store.
settings.json
MCP settings.
Web-search settings.

agent-tasks.json chứa conversation và tool output để resume. Knowledge store chứa chunk source code. Chat history chứa toàn bộ hội thoại.

fs.writeFile() mặc định thường tạo mode 0666 rồi phụ thuộc vào umask. Không nên dựa vào umask cho dữ liệu agent.

Trace và evaluation repository đã quan tâm 0o600; nên áp dụng cùng chuẩn cho toàn bộ userData.

3. write_file không có giới hạn kích thước

read_file và apply_patch kiểm tra MAX_FILE_BYTES, nhưng write_file có thể ghi nội dung kích thước tùy ý.

Model hoặc MCP output độc hại có thể khiến app:

Ghi file rất lớn.
Làm đầy ổ đĩa.
Làm nghẽn checkpoint/context.
Đóng băng UI hoặc Node event loop.

Cần giới hạn input, kích thước file và tổng write budget mỗi task.

4. Tool argument validation còn yếu

Model trả JSON hỏng thì parseToolArguments() trả {} im lặng. Tool schema chỉ được gửi cho model, chưa phải runtime validator thực sự.

Nên compile schema và validate ở biên tool executor. Lỗi cần nói rõ:

Invalid arguments: required property "path" is missing

thay vì để từng executor tự đọc chuỗi rỗng.

5. Persist settings chưa atomic và thiếu concurrency control

Settings repository:

Cache object mutable.
Trả cùng reference cho caller.
Không serialize write.
Ghi trực tiếp vào file đích.
Catch mọi lỗi load rồi có thể ghi đè default.

Hai IPC thay đổi settings đồng thời có thể tạo lost update. App crash lúc ghi có thể làm hỏng JSON.

Nên clone khi load, dùng queue/mutex và temporary-file rename.

Kiến trúc thực tế chưa tuân thủ chính quy tắc của dự án

Tài liệu nói component không được import infrastructure trực tiếp mà phải qua hook/application. Tuy nhiên các component vẫn import AgentBridge trực tiếp, gồm:

PromptComposer.tsx
SettingsView.tsx
TerminalView.tsx
TopAppBar.tsx
MacTrafficLights.tsx
WebSearchSettings.tsx
CodeBlock.tsx

Đây không phải lỗi bảo mật tự thân, nhưng chứng minh migration Clean Architecture chưa hoàn tất.

registerSettingsIpc.ts khoảng 187 dòng sau khi Repomix bỏ dòng trống, vượt ngưỡng cứng 150 dòng mà tài liệu dự án tự đặt. File này còn chứa:

URL normalization.
Model endpoint construction.
HTTP fetching.
Provider mutation.
Secret persistence.
Active model selection.
IPC handlers.

Nó đúng kiểu logic mà kiến trúc của dự án yêu cầu chuyển sang application use-case.

Ngoài ra tài liệu vẫn mô tả electron/main.ts khoảng 700 dòng và nhiều phần “hiện tại” không còn đúng. Tài liệu stale rất nguy hiểm trong repo agent-driven vì agent sau này có thể ra quyết định dựa trên trạng thái cũ.

Đánh giá test

Có khoảng 44 test file trong phần code được đóng gói. Đây là số lượng khá tốt cho alpha, nhưng phân bố chưa đúng theo risk.

Test tốt tập trung ở:

Pure domain validation.
Knowledge metrics.
Workflow transitions.
Optimizer state machine.
Skill signature/promotion.
Trace invariants.
Approval policy.
JSON repositories.

Những phần thiếu test đáng lo hơn:

Không có test thực sự cho sandbox process lifecycle.
Không test SIGTERM/SIGKILL.
Không test process descendants.
Không test symlink escape.
Không test write_file resource exhaustion.
Không test Electron same-window navigation.
Không test IPC sender/origin.
Không E2E chạy agent trên repository fixture.
Không test optimizer với agent run thực.
Test mang tên OpenAIProvider.test.ts thực tế chỉ kiểm tra việc ẩn/hiện web_search; không test SSE parser, malformed chunks, timeout hoặc tool-call delta.
RunAgentSession chỉ có test tracing đơn giản, chưa đủ bao phủ loop nhiều tool, pause/resume, malformed provider output và context compaction giữa phiên.

Tôi cũng chưa chạy được npm test hay npm run build vì nội dung được cung cấp là bản Repomix, không phải repository đầy đủ có dependency tree và build configuration hoàn chỉnh. Vì vậy không nên coi review này là xác nhận code đang compile.

Lộ trình sửa hợp lý
Giai đoạn 1 — Chặn rủi ro trước khi phát hành
Sửa process timeout và kill toàn process tree.
Chống symlink escape cho toàn bộ filesystem tools.
Đặt giới hạn cho write_file, tool output, MCP structured output và tổng task budget.
Chặn will-navigate, bật renderer sandbox, kiểm tra IPC sender.
Đặt 0600 và atomic write cho mọi dữ liệu trong userData.
Viết integration test cho sandbox, filesystem và Electron IPC.

Chưa hoàn thành giai đoạn này thì không nên cho người dùng mở repository hoặc chạy workspace-write trên máy chính.

Giai đoạn 2 — Làm evaluation thành thật
Chuyển golden suite thành task fixture.
Chạy agent thực trong temp workspace.
Thu observed result từ trace/diff/test.
Gắn config digest và build revision vào report.
Chạy paired baseline/candidate tự động.
Thêm cost, latency và policy gates.
Bắt đầu với khoảng 20–50 fixture chất lượng cao, không cần hàng trăm fixture giả.
Giai đoạn 3 — Biến optimizer thành optimizer
Sinh candidate tự động từ trace failure.
Chỉ thay một hoặc một nhóm parameter nhỏ mỗi experiment.
Sử dụng paired comparison.
Yêu cầu cải thiện trên nhiều run/model seed.
Có canary promotion và rollback tự động.
Không optimize trực tiếp permission, approval hoặc security boundary.
Giai đoạn 4 — Nâng skill learning
Không dùng Set làm mất sequence lặp.
Học precondition, state transition và validation.
Tổng hợp từ nhiều trace tương tự thay vì một trace.
Replay candidate trên held-out fixtures.
Chỉ promote khi có cải thiện đo được.
Giữ quy trình ký, duyệt và trust hiện có — phần này đang đúng hướng.
Nhận định cuối cùng

Điểm mạnh lớn nhất của dự án là tư duy nền tảng: tác giả không chỉ nghĩ về chat UI mà đã nghĩ tới policy, observability, evaluation, rollback, provenance, MCP và signed learning.

Điểm yếu lớn nhất là khoảng cách giữa tên tính năng và giá trị thực tế:

Evaluation hiện đánh giá dữ liệu dựng sẵn.
Optimizer chưa quan sát được tác động của config.
Skill learning chưa trích xuất được kỹ năng.
Sandbox chưa đủ đáng tin để bảo vệ máy người dùng.

Tôi sẽ định vị phiên bản hiện tại là:

Một agent platform research prototype có kiến trúc tốt và control plane khá trưởng thành, nhưng data plane đánh giá/tự học cùng security hardening vẫn chưa đạt mức dùng production.

Không cần viết lại từ đầu. Core architecture đáng giữ. Nhưng nên tạm dừng thêm tính năng mới, dành một chu kỳ phát triển riêng cho security hardening + real evaluation harness; hai phần đó sẽ quyết định dự án này trở thành sản phẩm thật hay chỉ tiếp tục phình thành một bộ màn hình có tên rất hay.