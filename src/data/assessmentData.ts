import { AssessmentData, Role } from '../types/assessment';

export const assessmentData: Record<Role, AssessmentData> = {
  'Content Creator': {
    duration: 30 * 60, // 30 minutes
    questions: [
      // Work Sample
      { 
        type: 'work_sample', 
        title: 'Work Sample - Nội dung & Ý tưởng (1/5)',
        text: 'Đâu là lựa chọn tốt nhất cho 3 tiêu đề YouTube về chủ đề "Một ngày làm việc của CEO khởi nghiệp"?',
        options: [
          '1. Nhật ký CEO, 2. Công việc của tôi, 3. Một ngày ở văn phòng',
          '1. CEO LÀM GÌ CẢ NGÀY?, 2. Vén màn sự thật về CEO, 3. Đừng làm CEO nếu bạn chưa xem video này',
          '1. A Day in the Life of a Startup CEO, 2. My Daily Routine, 3. How I work',
          '1. Video về CEO, 2. Tìm hiểu về khởi nghiệp, 3. Cuộc sống của doanh nhân'
        ],
        correct: 1
      },
      { 
        type: 'work_sample', 
        title: 'Work Sample - Nội dung & Ý tưởng (2/5)',
        text: 'Ý tưởng thumbnail nào hiệu quả nhất cho video "Một ngày làm việc của CEO khởi nghiệp"?',
        options: [
          'Ảnh văn phòng làm việc chuyên nghiệp, không có người.',
          'Logo của công ty trên nền màu đơn sắc.',
          'Ảnh cận mặt CEO với biểu cảm ngạc nhiên/shock, kèm text lớn "15 tiếng/ngày??".',
          'Một biểu đồ tăng trưởng doanh thu của công ty.'
        ],
        correct: 2
      },
      { 
        type: 'work_sample', 
        title: 'Work Sample - Nội dung & Ý tưởng (3/5)',
        text: 'Rút gọn caption Instagram sau (hiện 80 từ): "Chúng tôi vô cùng tự hào thông báo về việc ra mắt sản phẩm mới nhất, được thiết kế tỉ mỉ bởi đội ngũ chuyên gia hàng đầu. Sản phẩm này giải quyết vấn đề XYZ và có các tính năng ABC. Hãy truy cập website của chúng tôi để tìm hiểu thêm và đặt hàng ngay hôm nay, link ở bio. Cảm ơn sự ủng hộ của các bạn." thành một caption dưới 50 từ.',
        options: [
          'Sản phẩm mới ra mắt! Được thiết kế bởi chuyên gia, giải quyết vấn đề XYZ. Tìm hiểu thêm và đặt hàng tại link ở bio.',
          'Đừng để XYZ làm phiền bạn nữa! ✨ Sản phẩm mới của chúng tôi đã ở đây để giải cứu. Thiết kế đẳng cấp, tính năng vượt trội. Sẵn sàng thay đổi cuộc chơi? 🔥 Link ở bio!',
          'Thông báo ra mắt sản phẩm mới. Đây là một sản phẩm tuyệt vời. Mọi người nên mua nó. Link ở bio.',
          'Sản phẩm mới của chúng tôi rất tốt. Nó có tính năng ABC. Nó giải quyết vấn đề XYZ. Hãy mua nó. Link ở bio.'
        ],
        correct: 1
      },
      { 
        type: 'work_sample', 
        title: 'Work Sample - Nội dung & Ý tưởng (4/5)',
        text: 'Kịch bản TikTok 15s nào có khả năng viral cao nhất cho chủ đề "chăm sóc sức khoẻ tinh thần cho Gen Z"?',
        options: [
          'Một chuyên gia nói chuyện trong 15s về lợi ích của thiền định.',
          'Video quay cảnh bình minh với nhạc nhẹ và dòng chữ "Hãy yêu bản thân".',
          'Trend biến hình: Bắt đầu với cảnh một người trông mệt mỏi, chữ "Khi deadline dí 🤯". Sau đó biến hình thành một người tươi tắn, chữ "Nhưng tôi nhớ ra 5 phút hít thở sâu ✨".',
          'Liệt kê 10 ứng dụng chăm sóc sức khỏe tinh thần trong 15 giây.'
        ],
        correct: 2
      },
      { 
        type: 'work_sample', 
        title: 'Work Sample - Nội dung & Ý tưởng (5/5)',
        text: 'Đâu là so sánh khác biệt cốt lõi nhất khi viết nội dung cho Facebook và TikTok?',
        options: [
          'Facebook cần ảnh đẹp, TikTok không cần.',
          'Facebook ưu tiên nội dung dài, chi tiết, mang tính cộng đồng. TikTok ưu tiên video ngắn, giải trí cao, bắt trend nhanh chóng.',
          'Nội dung trên Facebook luôn luôn nghiêm túc, còn TikTok luôn luôn hài hước.',
          'Cả hai nền tảng đều giống nhau, chỉ cần đăng cùng một nội dung là được.'
        ],
        correct: 1
      },
      // Problem Solving
      {
        type: 'problem_solving',
        title: 'Problem Solving / Logic (6/12)',
        text: 'Một video trên kênh bạn có tỷ lệ nhấp (CTR) 1.5% sau 28 ngày (rất thấp). Yếu tố nào bạn sẽ kiểm tra và tối ưu đầu tiên?',
        options: [
          'Nội dung và kịch bản của video.',
          'Tiêu đề và ảnh thumbnail của video.',
          'Phần mô tả và các thẻ (tags) của video.',
          'Thời điểm đăng video.'
        ],
        correct: 1
      },
      {
        type: 'problem_solving',
        title: 'Problem Solving / Logic (7/12)',
        text: 'Video A được 10k view, video B được 1k view, nhưng B có thời gian xem trung bình gấp đôi A. Bạn nên ưu tiên phát triển dòng nội dung nào?',
        options: [
          'Loại nội dung A, vì nó tiếp cận được nhiều người hơn.',
          'Ngừng sản xuất cả hai loại và thử một ý tưởng hoàn toàn mới.',
          'Cả hai như nhau, không có gì khác biệt.',
          'Loại nội dung B, vì nó tạo ra một lượng khán giả trung thành và chất lượng hơn.'
        ],
        correct: 3
      },
      {
        type: 'problem_solving',
        title: 'Problem Solving / Logic (8/12)',
        text: 'Một bài post đạt lượt tiếp cận (reach) cao nhưng tương tác (engagement) thấp. Đâu là hai giả thuyết hợp lý nhất?',
        options: [
          'Nội dung quá hay và hình ảnh quá đẹp.',
          'Nội dung gây tò mò nhưng không có lời kêu gọi hành động (CTA) rõ ràng, và/hoặc nội dung không thực sự liên quan đến insight của người xem.',
          'Bài viết được đăng vào giờ vàng.',
          'Đối thủ đang chạy quảng cáo mạnh hơn.'
        ],
        correct: 1
      },
      // Values & Reliability
      {
        type: 'reliability',
        title: 'Values & Reliability (9/12)',
        text: 'Khi deadline gấp, bạn không chắc nội dung đã tối ưu. Bạn chọn: (A) Xuất bản đúng giờ dù chưa hoàn hảo, hay (B) Hoãn lại để chỉnh kỹ. Lựa chọn nào thể hiện sự chuyên nghiệp?',
        options: [
          'Chọn (B) vì chất lượng là quan trọng nhất.',
          'Chọn (A) vì giữ lời hứa về deadline là quan trọng nhất.',
          'Giao tiếp ngay với quản lý: thông báo về tình trạng, đề xuất một khoảng thời gian ngắn (ví dụ: 1-2 giờ) để hoàn thiện, và tuân theo quyết định cuối cùng của họ.',
          'Lặng lẽ chọn (A) và hy vọng không ai nhận ra lỗi.'
        ],
        correct: 2
      },
      {
        type: 'reliability',
        title: 'Values & Reliability (10/12)',
        text: 'Nếu được giao việc "viết 20 caption" trong 1 ngày, chiến lược phân bổ thời gian nào là hiệu quả nhất?',
        options: [
          'Dành cả ngày để viết một lèo từ caption 1 đến 20.',
          'Sáng nghiên cứu ý tưởng, chiều viết, tối chỉnh sửa.',
          'Chia nhỏ công việc: Dành 1-2 giờ đầu để nghiên cứu và lên dàn ý chung cho cả 20 captions, sau đó viết theo cụm (batching), và cuối cùng dành thời gian để đọc lại và sửa lỗi.',
          'Viết mỗi giờ 2-3 cái, xen kẽ với các việc khác.'
        ],
        correct: 2
      },
      {
        type: 'culture_fit',
        title: 'Values & Reliability (11/12)',
        text: 'Bạn nhận feedback tiêu cực từ sếp về bài viết bạn rất tâm huyết. Phản ứng đầu tiên của bạn là gì?',
        options: [
          'Cảm thấy buồn và mất động lực, cho rằng sếp không hiểu mình.',
          'Tranh luận để bảo vệ quan điểm và chứng minh rằng mình đúng.',
          'Lắng nghe cẩn thận, hỏi lại để làm rõ các điểm feedback, cảm ơn góp ý và đề xuất phương án chỉnh sửa.',
          'Đồng ý ngay lập tức mà không thực sự hiểu vấn đề để tránh xung đột.'
        ],
        correct: 2
      },
      {
        type: 'culture_fit',
        title: 'Values & Reliability (12/12)',
        text: 'Trong một dự án, bạn nhận thấy quy trình hiện tại không hiệu quả. Hành động nào thể hiện sự chủ động nhất?',
        options: [
          'Tiếp tục làm theo quy trình cũ vì đó là quy định.',
          'Than phiền với đồng nghiệp về sự bất cập.',
          'Chờ cuộc họp tiếp theo để nêu vấn đề.',
          'Tự nghiên cứu một giải pháp thay thế, kiểm tra nó ở quy mô nhỏ, sau đó trình bày dữ liệu và đề xuất cải tiến cho quản lý.'
        ],
        correct: 3
      }
    ]
  },
  'Customer Support': { 
    duration: 25 * 60, // 25 minutes
    questions: [
      // Work Sample
      {
        type: 'work_sample',
        title: 'Work Sample - Tình huống (1/5)',
        text: 'Khách hàng tức giận vì giao hàng trễ, bạn sẽ chọn phản hồi nào qua email?',
        options: [
          'Chào bạn, chúng tôi rất xin lỗi về sự chậm trễ này. Mã vận đơn của bạn cho thấy đơn hàng đang gặp sự cố. Chúng tôi đã thúc đẩy và dự kiến bạn sẽ nhận được hàng trong 2 ngày tới. Chúng tôi xin gửi bạn voucher giảm giá 10% cho lần mua sau để bù đắp.',
          'Chào bạn, việc giao hàng trễ là do bên vận chuyển, không phải lỗi của chúng tôi. Vui lòng liên hệ họ để biết thêm chi tiết.',
          'Chào bạn, vấn đề của bạn đã được ghi nhận. Chúng tôi sẽ xử lý.',
          'Chào bạn, rất tiếc về trải nghiệm của bạn. Cảm ơn bạn đã thông báo.'
        ],
        correct: 0
      },
      {
        type: 'work_sample',
        title: 'Work Sample - Tình huống (2/5)',
        text: 'Khách hàng nhắn tin: “Sản phẩm của tôi bị lỗi, tôi rất thất vọng!” Phản hồi đầu tiên nào là tốt nhất trong chat support?',
        options: [
          'Chào bạn, bạn vui lòng mô tả lỗi cụ thể được không?',
          'Chào bạn, chính sách đổi trả của chúng tôi ở đây nhé [link].',
          'Chào bạn, tôi rất tiếc khi nghe điều này. Để tôi có thể hỗ trợ tốt nhất, bạn có thể cho tôi biết mã đơn hàng và mô tả rõ hơn về lỗi sản phẩm được không ạ?',
          'Chào bạn, sản phẩm của chúng tôi rất hiếm khi bị lỗi.'
        ],
        correct: 2
      },
      {
        type: 'work_sample',
        title: 'Work Sample - Tình huống (3/5)',
        text: 'Nếu khách hàng hỏi một câu mà bạn không biết câu trả lời, bạn sẽ làm gì?',
        options: [
          'Đoán một câu trả lời để khách hàng không phải chờ.',
          'Thành thật nói: "Đây là một câu hỏi rất hay, tôi cần kiểm tra lại thông tin với bộ phận chuyên môn để đảm bảo câu trả lời chính xác nhất. Bạn vui lòng chờ trong giây lát hoặc để lại email nhé?"',
          'Nói rằng đây không phải chuyên môn của bạn và kết thúc cuộc trò chuyện.',
          'Phớt lờ câu hỏi đó và trả lời những câu bạn biết.'
        ],
        correct: 1
      },
      {
        type: 'work_sample',
        title: 'Work Sample - Tình huống (4/5)',
        text: 'Bạn nhận được 5 email khiếu nại cùng lúc. Trường hợp nào cần ưu tiên xử lý trước nhất?',
        options: [
          'Email hỏi về chính sách bảo hành sản phẩm.',
          'Email khách hàng doạ sẽ "bóc phốt" công ty lên mạng xã hội vì sản phẩm lỗi.',
          'Email yêu cầu hỗ trợ kỹ thuật cho một tính năng không quan trọng.',
          'Email phàn nàn về việc website tải chậm.'
        ],
        correct: 1
      },
      {
        type: 'work_sample',
        title: 'Work Sample - Tình huống (5/5)',
        text: 'Đâu là phiên bản rút gọn lịch sự, dễ đọc nhất cho một email CS dài dòng, khó hiểu?',
        options: [
          'Giữ nguyên văn bản gốc để đảm bảo đầy đủ thông tin.',
          'Xóa bớt các đoạn không cần thiết, dùng câu ngắn và gạch đầu dòng để tóm tắt các bước giải quyết cho khách hàng.',
          'Chỉ trả lời bằng một câu: "Vấn đề của bạn đã được giải quyết."',
          'Viết lại bằng ngôn ngữ kỹ thuật phức tạp hơn để thể hiện sự chuyên nghiệp.'
        ],
        correct: 1
      },
      // Problem Solving
      {
        type: 'problem_solving',
        title: 'Problem Solving / Logic (6/8)',
        text: 'Khách hàng báo lỗi: “App của tôi không mở được”. Bạn cần hỏi thêm 3 câu gì để làm rõ vấn đề?',
        options: [
          '1. Bạn đã thử khởi động lại máy chưa? 2. Bạn có đang dùng wifi không? 3. Bạn đã mua app khi nào?',
          '1. Lỗi này bắt đầu xuất hiện khi nào? 2. Bạn đang dùng thiết bị gì (ví dụ: iPhone 13, Samsung S22)? 3. Có thông báo lỗi cụ thể nào hiện ra không?',
          '1. Bạn có thích app của chúng tôi không? 2. Bạn dùng app vào mục đích gì? 3. Tại sao bạn không thử dùng app khác?',
          '1. Bạn có chắc là app bị lỗi không? 2. Bạn đã cập nhật hệ điều hành chưa? 3. Bạn có muốn hoàn tiền không?'
        ],
        correct: 1
      },
      {
        type: 'problem_solving',
        title: 'Problem Solving / Logic (7/8)',
        text: 'Nếu 70% ticket của tuần liên quan đến cùng một lỗi phần mềm, bạn sẽ báo cáo cho ai và bằng cách nào?',
        options: [
          'Không làm gì cả, chỉ tiếp tục trả lời từng ticket một.',
          'Than phiền với đồng nghiệp trong giờ nghỉ trưa.',
          'Báo cáo cho trưởng nhóm CS và Product Manager, kèm theo số liệu thống kê (số lượng ticket, mô tả lỗi, mức độ ảnh hưởng) để đề xuất ưu tiên sửa lỗi.',
          'Viết một bài đăng lên mạng xã hội thông báo về lỗi.'
        ],
        correct: 2
      },
      {
        type: 'problem_solving',
        title: 'Problem Solving / Logic (8/8)',
        text: 'Khách hàng nói “tôi đã gửi email từ tuần trước mà chưa ai trả lời”. Đâu là hướng xử lý tốt nhất?',
        options: [
          'Trả lời: "Chắc chắn là bạn đã gửi nhầm địa chỉ email."',
          'Xin lỗi khách hàng, sau đó ngay lập tức tìm kiếm email của họ trong hệ thống (kiểm tra cả spam). Nếu tìm thấy, xử lý ngay. Nếu không, nhờ họ gửi lại và ưu tiên giải quyết.',
          'Yêu cầu khách hàng cung cấp bằng chứng đã gửi email.',
          'Nói rằng hệ thống đang bị quá tải và yêu cầu họ chờ thêm.'
        ],
        correct: 1
      },
      // Values & Reliability
      {
        type: 'reliability',
        title: 'Values & Reliability (9/12)',
        text: 'Bạn được yêu cầu trả lời 20 ticket/ngày nhưng có 1 case rất khó, chiếm 2 giờ. Bạn xử lý ra sao?',
        options: [
          'Bỏ qua case khó để tập trung hoàn thành đủ số lượng.',
          'Dành 2 giờ giải quyết case khó, sau đó báo cáo rằng không thể hoàn thành chỉ tiêu vì case đó.',
          'Thông báo sớm cho trưởng nhóm về case phức tạp, xin ý kiến về việc có thể tạm gác lại hoặc cần sự hỗ trợ, đồng thời cố gắng hoàn thành các ticket khác nhanh nhất có thể.',
          'Làm việc qua loa case khó để tiết kiệm thời gian.'
        ],
        correct: 2
      },
      {
        type: 'culture_fit',
        title: 'Values & Reliability (10/12)',
        text: 'Một khách hàng cực kỳ thô lỗ, xúc phạm bạn. Bạn sẽ phản ứng thế nào?',
        options: [
          'Ngắt kết nối hoặc cúp máy ngay lập tức.',
          'Giữ bình tĩnh, không phản ứng lại sự xúc phạm, và tập trung vào vấn đề chuyên môn của họ. Nếu tình hình leo thang, thông báo rằng bạn sẽ kết thúc cuộc gọi và báo cáo lại cho quản lý.',
          'Cãi lại và nói rằng họ không có quyền nói chuyện như vậy.',
          'Bật khóc và kể cho đồng nghiệp nghe.'
        ],
        correct: 1
      },
      {
        type: 'reliability',
        title: 'Values & Reliability (11/12)',
        text: 'Khi bạn nhận ra mình đã mắc lỗi khi trả lời khách hàng, bạn sẽ làm gì?',
        options: [
          'Im lặng và hy vọng khách hàng không phát hiện ra.',
          'Đổ lỗi cho hệ thống hoặc một đồng nghiệp khác.',
          'Chủ động liên hệ lại với khách hàng, xin lỗi về sai sót, cung cấp thông tin đúng và đưa ra giải pháp khắc phục (nếu cần).',
          'Chờ đến khi khách hàng phàn nàn thì mới giải quyết.'
        ],
        correct: 2
      },
      {
        type: 'reliability',
        title: 'Values & Reliability (12/12)',
        text: 'Nếu ca làm hôm đó thiếu người, bạn có sẵn sàng ở lại thêm giờ không?',
        options: [
          'Từ chối ngay lập tức vì đã hết giờ làm việc.',
          'Miễn cưỡng ở lại nhưng làm việc không hiệu quả.',
          'Kiểm tra lịch trình cá nhân, nếu có thể, sẵn sàng hỗ trợ thêm giờ để đảm bảo công việc chung không bị ảnh hưởng, và thông báo rõ ràng về khả năng của mình.',
          'Ở lại nhưng yêu cầu phải được trả lương gấp ba.'
        ],
        correct: 2
      }
    ] 
  },
  'Operations': { 
    duration: 25 * 60, // 25 minutes
    questions: [
      {
        type: 'work_sample',
        title: 'Work Sample – SOP & Task Management (1/12)',
        text: 'Bạn nhận nhiệm vụ tổ chức workshop offline cho 50 người. Checklist nào sau đây là đầy đủ và hợp lý nhất?',
        options: [
          '1. Đặt địa điểm, 2. Mời khách.',
          '1. Tìm địa điểm, 2. Gửi email mời, 3. Chuẩn bị slide, 4. Tổ chức sự kiện, 5. Gửi email cảm ơn.',
          '1. Lên kế hoạch (ngân sách, mục tiêu), 2. Tìm & chốt địa điểm/vendor, 3. Truyền thông & mời khách, 4. Chuẩn bị hậu cần (tài liệu, teabreak), 5. Điều phối sự kiện, 6. Tổng kết & báo cáo.',
          '1. In tài liệu, 2. Đặt teabreak, 3. Gửi email nhắc nhở.'
        ],
        correct: 2
      },
      {
        type: 'work_sample',
        title: 'Work Sample – SOP & Task Management (2/12)',
        text: 'Đâu là một SOP (Quy trình vận hành chuẩn) tốt nhất để đặt vé máy bay công tác cho nhân viên?',
        options: [
          'Nhân viên tự đặt rồi gửi hóa đơn về cho kế toán.',
          'Bước 1: Nhân viên gửi yêu cầu. Bước 2: Admin tìm vé. Bước 3: Nhân viên xác nhận. Bước 4: Admin đặt vé.',
          'Bước 1: Nhân viên điền form yêu cầu (thông tin, ngân sách). Bước 2: Admin tìm 2-3 lựa chọn vé phù hợp. Bước 3: Gửi cho nhân viên & quản lý duyệt. Bước 4: Xuất vé & gửi xác nhận. Bước 5: Lưu hồ sơ.',
          'Bước 1: Gọi điện cho đại lý vé. Bước 2: Gửi thông tin nhân viên qua Zalo. Bước 3: Chờ đại lý gửi lại vé.'
        ],
        correct: 2
      },
      {
        type: 'work_sample',
        title: 'Work Sample – SOP & Task Management (3/12)',
        text: 'Bạn được giao 3 việc cùng lúc: (A) Gửi báo cáo định kỳ (hạn cuối ngày), (B) Đặt lịch họp cho sếp vào tuần sau, (C) Xử lý email có tag "Khẩn" từ đối tác. Thứ tự ưu tiên nào là hợp lý nhất?',
        options: [
          'A, B, C',
          'B, C, A',
          'C, A, B',
          'A, C, B'
        ],
        correct: 2
      },
      {
        type: 'work_sample',
        title: 'Work Sample – SOP & Task Management (4/12)',
        text: 'Một file Excel nhân viên gửi cho bạn bị lỗi công thức, dữ liệu hiển thị sai. Bạn sẽ xử lý ra sao?',
        options: [
          'Tự sửa lại file mà không nói gì.',
          'Gửi trả lại file và nói "File bị lỗi, làm lại đi".',
          'Gửi lại file, khoanh vùng chỗ lỗi, hướng dẫn/gợi ý cách sửa và nhờ họ kiểm tra lại để đảm bảo họ hiểu vấn đề cho các lần sau.',
          'Báo cáo với sếp rằng nhân viên đó làm việc không cẩn thận.'
        ],
        correct: 2
      },
      {
        type: 'work_sample',
        title: 'Work Sample – SOP & Task Management (5/12)',
        text: 'Để quản lý 5 vendor khác nhau cho một sự kiện, phương pháp nào hiệu quả nhất để theo dõi tiến độ?',
        options: [
          'Gọi điện cho từng người mỗi ngày.',
          'Tạo một file Google Sheet chung, ghi rõ đầu việc, người phụ trách, deadline và yêu cầu các vendor cập nhật trạng thái hàng ngày. Đồng thời, có lịch họp check-in ngắn định kỳ.',
          'Chỉ làm việc qua email và chờ họ tự báo cáo.',
          'Nhắn tin Zalo hỏi từng người khi nhớ ra.'
        ],
        correct: 1
      },
      {
        type: 'problem_solving',
        title: 'Problem Solving / Logic (6/12)',
        text: 'Trong báo cáo chi phí, bạn thấy một khoản lặp lại 2 lần. Hướng xử lý nào là chuyên nghiệp nhất?',
        options: [
          'Lặng lẽ xóa một dòng đi và coi như không có chuyện gì.',
          'Đi hỏi người làm báo cáo và yêu cầu họ giải thích.',
          'Đánh dấu khoản chi phí bị trùng, kiểm tra lại với hóa đơn gốc, sau đó báo cáo cho quản lý và bộ phận kế toán về phát hiện này và đề xuất hướng xử lý.',
          'Gửi email cho cả team và hỏi xem ai đã làm sai.'
        ],
        correct: 2
      },
      {
        type: 'problem_solving',
        title: 'Problem Solving / Logic (7/12)',
        text: 'Một đối tác quan trọng gọi điện khi bạn đang trong một cuộc họp nội bộ. Bạn sẽ phản ứng thế nào?',
        options: [
          'Ngắt máy ngay lập tức.',
          'Rời khỏi cuộc họp để nghe điện thoại.',
          'Từ chối cuộc gọi và ngay lập tức gửi một tin nhắn ngắn: "Xin lỗi, tôi đang họp. Tôi sẽ gọi lại cho bạn sau X phút nữa nhé." Sau đó tập trung họp và gọi lại đúng hẹn.',
          'Phớt lờ cuộc gọi và hy vọng họ sẽ gọi lại sau.'
        ],
        correct: 2
      },
      {
        type: 'problem_solving',
        title: 'Problem Solving / Logic (8/12)',
        text: 'Hệ thống quản lý tour bị lỗi không gửi email thông báo tự động cho khách. Đâu là 2 giả thuyết và cách xử lý hợp lý?',
        options: [
          'Giả thuyết: Khách hàng không biết dùng email. Cách xử lý: Không làm gì.',
          'Giả thuyết: Hệ thống sập. Cách xử lý: Chờ IT sửa.',
          'Giả thuyết: Lỗi server mail hoặc lỗi tác vụ tự động (cron job). Cách xử lý: Báo cho IT, đồng thời xuất danh sách khách hàng và gửi email thủ công để xử lý tạm thời.',
          'Giả thuyết: Khách hàng nhập sai email. Cách xử lý: Yêu cầu tất cả khách hàng đăng ký lại.'
        ],
        correct: 2
      },
      {
        type: 'reliability',
        title: 'Values & Reliability (9/12)',
        text: 'Sếp yêu cầu nộp báo cáo gấp trong 1 giờ, nhưng bạn biết chất lượng sẽ không cao. Bạn sẽ làm gì?',
        options: [
          'Làm qua loa cho kịp deadline.',
          'Nói với sếp rằng bạn không thể làm được trong 1 giờ.',
          'Phản hồi ngay: "Em đã nhận được yêu cầu. Với 1 giờ, em có thể hoàn thành các mục A, B, C. Các mục D, E cần thêm thời gian để đảm bảo chính xác. Anh/chị có ưu tiên mục nào không ạ?"',
          'Im lặng và cố gắng làm, sau đó nộp muộn.'
        ],
        correct: 2
      },
      {
        type: 'culture_fit',
        title: 'Values & Reliability (10/12)',
        text: 'Nếu trong team có người không hoàn thành công việc khiến bạn bị trễ deadline, bạn sẽ xử lý ra sao?',
        options: [
          'Báo cáo ngay với sếp rằng đó là lỗi của người kia.',
          'Làm thay phần việc của họ mà không nói gì.',
          'Chủ động hỏi thăm đồng nghiệp xem họ có gặp khó khăn gì không và đề nghị hỗ trợ. Nếu tình hình không cải thiện, sẽ trao đổi riêng với họ trước khi cần báo cáo lên cấp trên.',
          'Than phiền với các đồng nghiệp khác.'
        ],
        correct: 2
      },
      {
        type: 'reliability',
        title: 'Values & Reliability (11/12)',
        text: 'Hành động nào sau đây thể hiện tốt nhất việc bạn đã chủ động cải tiến một quy trình công việc?',
        options: [
          'Luôn làm đúng theo quy trình đã có.',
          'Nhận thấy việc lưu file lộn xộn, bạn tự đề xuất và tạo một cấu trúc thư mục chung cho cả team, sau đó hướng dẫn mọi người làm theo.',
          'Chỉ ra các điểm bất hợp lý trong các cuộc họp nhưng không đề xuất giải pháp.',
          'Thường xuyên phàn nàn về các quy trình hiện tại.'
        ],
        correct: 1
      },
      {
        type: 'culture_fit',
        title: 'Values & Reliability (12/12)',
        text: 'Khi làm việc với nhiều bộ phận, bạn làm gì để tránh mất thông tin hoặc bỏ sót task?',
        options: [
          'Chỉ làm việc qua trao đổi miệng.',
          'Ghi chú ra giấy nhớ cá nhân.',
          'Sử dụng công cụ quản lý công việc (Asana, Trello) hoặc tóm tắt các quyết định và đầu việc qua email sau mỗi cuộc họp để tất cả các bên cùng xác nhận.',
          'Giả định rằng mọi người sẽ tự nhớ việc của mình.'
        ],
        correct: 2
      }
    ] 
  }
};
