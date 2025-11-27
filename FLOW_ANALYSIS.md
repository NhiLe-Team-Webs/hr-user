# Phân Tích Flow HR User - Hiện Trạng

## Flow Mong Muốn
1. Người ngoài đăng ký
2. Vào profile để lưu thông tin đăng ký
3. Chọn role
4. Vào làm trắc nghiệm
5. AI chấm điểm
6. Nhận kết quả
7. Đợi HR đồng ý
8. Lần đầu vào web thì link tới kết quả chứ KHÔNG cho làm lại

## Phân Tích Logic Hiện Tại

### 1. resolveAssessmentState Function
Hàm này quyết định route tiếp theo dựa trên trạng thái của user.

Logic hiện tại:
1. Kiểm tra Result trước - Query bảng results để tìm result mới nhất
   - Nếu có result → return nextRoute: '/result'
   - Set assessmentResult với dữ liệu từ DB
   
2. Nếu không có result - Query bảng assessment_attempts
   - Tìm attempt chưa submit (submitted_at IS NULL)
   - Và status khác 'completed'
   - Nếu có → return nextRoute: '/assessment'
   
3. Nếu không có gì → return nextRoute: '/role-selection'

### 2. Protected Route Logic
Nếu có assessmentResult hoặc nextRoute === '/result', redirect về /result

### 3. Landing/Login Route Logic
User đã login sẽ được redirect theo nextRoute từ resolveAssessmentState

### 4. Role Selection Screen
KHÔNG CÓ LOGIC NGĂN CHẶN người dùng đã có result chọn role mới
- Screen này chỉ hiển thị danh sách roles
- Cho phép click vào bất kỳ role nào
- Không kiểm tra xem user đã có result hay chưa

### 5. Start Assessment Logic
KHÔNG KIỂM TRA xem user đã có result trong bảng results hay chưa


### 6. Database Schema
- results table: Lưu kết quả AI analysis, có field hr_review_status
- assessment_attempts table: Lưu các lần làm bài
- KHÔNG CÓ constraint ngăn tạo nhiều results/attempts cho cùng profile

## VẤN ĐỀ PHÁT HIỆN

### 1. User có thể làm lại bài test
- Khi user đã có result, nếu họ manually navigate đến /role-selection
- Họ có thể chọn role mới
- System sẽ tạo attempt mới
- Cho phép làm bài lại

### 2. Không có validation khi tạo attempt mới
- startAssessmentAttempt chỉ check existing attempt
- KHÔNG check xem user đã có result trong bảng results
- Cho phép tạo attempt mới ngay cả khi đã có result

### 3. Router redirect không đủ mạnh
- ProtectedRoute chỉ redirect khi có assessmentResult trong context
- Nếu user clear session storage hoặc mở tab mới
- Context sẽ empty, cho phép access /role-selection

### 4. Không có UI indicator
- Không có thông báo cho user biết họ đã hoàn thành
- Không disable role selection khi đã có result
- Không có message "Bạn đã hoàn thành đánh giá"

## GIẢI PHÁP ĐỀ XUẤT

### 1. Thêm validation trong startAssessmentAttempt
Check if user already has a result before creating new attempt

### 2. Update resolveAssessmentState
Luôn check result trước và force redirect về /result nếu có

### 3. Thêm guard trong RoleSelectionScreen
Check if user has result và redirect về /result nếu có

### 4. Thêm database constraint (optional)
Add unique constraint to prevent multiple results per profile

### 5. Update ResultScreen
Hiển thị status rõ ràng và disable/ẩn nút làm lại

## KẾT LUẬN

Hiện tại flow CHƯA ĐÚNG với yêu cầu:
- User CÓ THỂ làm lại bài test
- Không có validation ngăn tạo attempt mới khi đã có result
- Router redirect không đủ để ngăn chặn
- Không có UI feedback rõ ràng

Cần implement các giải pháp trên để đảm bảo:
- User chỉ làm bài 1 lần
- Lần vào sau luôn redirect về result
- Không cho phép chọn role mới khi đã có result
- UI hiển thị rõ trạng thái và không cho làm lại


---

## IMPLEMENTATION COMPLETED

### Changes Made:

1. **startAssessmentAttempt validation** (assessments.ts)
   - Added check for existing result before creating new attempt
   - Throws error: "Ban da hoan thanh danh gia. Khong the lam lai."

2. **RoleSelectionScreen guard** (RoleSelectionScreen.tsx)
   - Added check for existing result on component mount
   - Redirects to /result if user already has result
   - Prevents user from selecting new role

3. **PreAssessmentScreen error handling** (PreAssessmentScreen.tsx)
   - Enhanced error handling to detect "already completed" errors
   - Shows toast notification and redirects to /result
   - Added assessmentId to setActiveAttempt call

4. **ResultScreen UI feedback** (ResultScreen.tsx)
   - Added message: "Bạn chỉ có thể làm bài đánh giá một lần duy nhất"
   - Shows when HR status is not approved
   - Clear indication that retakes are not allowed

5. **Translations** (vi.json, en.json, locales.ts)
   - Added cannotRetakeMessage to both languages
   - VI: "Lưu ý: Bạn chỉ có thể làm bài đánh giá một lần duy nhất. Không thể làm lại."
   - EN: "Note: You can only take the assessment once. Retakes are not allowed."

6. **Database constraint** (migration 20251127000002)
   - Added unique index on results(profile_id)
   - Ensures database-level enforcement
   - Prevents multiple results per profile

### Flow Now Works As Expected:

✅ User registers/logs in
✅ Completes profile
✅ Selects role (only once)
✅ Takes assessment (only once)
✅ AI scores the assessment
✅ Receives result
✅ Waits for HR approval
✅ **On subsequent visits: Redirected to result page**
✅ **Cannot select new role**
✅ **Cannot start new assessment**
✅ **Clear UI message about no retakes**

### Protection Layers:

1. **UI Layer**: RoleSelectionScreen checks and redirects
2. **API Layer**: startAssessmentAttempt validates before creating
3. **Database Layer**: Unique constraint prevents duplicates
4. **UX Layer**: Clear messaging about one-time assessment
