export default {
  async fetch(request, env) {
    // Cấu hình CORS để cho phép SketchUp gửi request lên máy chủ
    const corsHeaders = { 
      "Access-Control-Allow-Origin": "*", 
      "Access-Control-Allow-Methods": "POST, OPTIONS", 
      "Access-Control-Allow-Headers": "Content-Type" 
    };
    
    // Xử lý preflight request
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    
    // Chỉ chấp nhận phương thức POST
    if (request.method !== "POST") return new Response("Only POST requests allowed", { status: 405, headers: corsHeaders });

    try {
      // Nhận dữ liệu gửi lên từ Plugin SketchUp
      const { license_key, machine_id } = await request.json();
      
      if (!license_key || !machine_id) {
        return new Response(JSON.stringify({ success: false, message: "Thiếu dữ liệu xác thực (Key hoặc Mã máy)!" }), { status: 400, headers: corsHeaders });
      }

      // Tìm Key trong cơ sở dữ liệu KV (Không gian lưu trữ LICENSES)
      const licenseDataStr = await env.LICENSES.get(license_key);
      if (!licenseDataStr) {
        return new Response(JSON.stringify({ success: false, message: "Mã bản quyền không tồn tại trên hệ thống!" }), { status: 404, headers: corsHeaders });
      }

      let licenseData = JSON.parse(licenseDataStr);
      
      // Kiểm tra trạng thái Key (có bị khóa hay không)
      if (licenseData.status !== "active") {
        return new Response(JSON.stringify({ success: false, message: "Mã bản quyền đã bị khóa hoặc hết hạn!" }), { status: 403, headers: corsHeaders });
      }

      // Đối chiếu Machine ID (Mã thiết bị)
      if (!licenseData.machine_id || licenseData.machine_id === "") {
        // Lần đầu kích hoạt -> Lưu luôn mã máy vào Database để khóa cứng Key với máy này
        licenseData.machine_id = machine_id;
        await env.LICENSES.put(license_key, JSON.stringify(licenseData));
        return new Response(JSON.stringify({ success: true, message: "Kích hoạt thành công lần đầu!" }), { status: 200, headers: corsHeaders });
        
      } else if (licenseData.machine_id === machine_id) {
        // Máy cũ xài lại Key cũ -> Hợp lệ, cho phép qua
        return new Response(JSON.stringify({ success: true, message: "Xác thực bản quyền thành công!" }), { status: 200, headers: corsHeaders });
        
      } else {
        // Key này đang cắm vào máy khác -> Chặn ngay lập tức
        return new Response(JSON.stringify({ success: false, message: "Mã bản quyền này đã được sử dụng trên một máy tính khác!" }), { status: 403, headers: corsHeaders });
      }
      
    } catch (err) {
      return new Response(JSON.stringify({ success: false, message: "Lỗi máy chủ cấp phép: " + err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
