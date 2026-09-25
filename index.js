export default {
  async fetch(request, env) {
    const corsHeaders = { 
      "Access-Control-Allow-Origin": "*", 
      "Access-Control-Allow-Methods": "POST, OPTIONS", 
      "Access-Control-Allow-Headers": "Content-Type" 
    };
    
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "POST") return new Response("Only POST requests allowed", { status: 405, headers: corsHeaders });

    try {
      const { license_key, machine_id } = await request.json();
      
      if (!license_key || !machine_id) {
        return new Response(JSON.stringify({ success: false, message: "Thiếu dữ liệu xác thực!" }), { status: 400, headers: corsHeaders });
      }

      const licenseDataStr = await env.LICENSES.get(license_key);
      if (!licenseDataStr) {
        return new Response(JSON.stringify({ success: false, message: "Mã bản quyền không tồn tại!" }), { status: 404, headers: corsHeaders });
      }

      let licenseData = JSON.parse(licenseDataStr);
      
      // 1. Kiểm tra trạng thái
      if (licenseData.status !== "active") {
        return new Response(JSON.stringify({ success: false, message: "Mã bản quyền đã bị khóa hoặc ngừng hoạt động!" }), { status: 403, headers: corsHeaders });
      }

      // 2. Kiểm tra thời hạn (Expiry Date)
      if (licenseData.expiry_date) {
        const today = new Date().toISOString().split('T')[0];
        if (today > licenseData.expiry_date) {
          return new Response(JSON.stringify({ success: false, message: "Mã bản quyền đã hết hạn sử dụng!" }), { status: 403, headers: corsHeaders });
        }
      }

      // 3. Phân biệt loại Key: Dùng chung (shared) hay Cá nhân khóa máy (personal)
      if (licenseData.type === "shared") {
        // Key dùng chung cho phép mọi máy đều qua mà không cần check machine_id
      } else {
        // Key cá nhân: Khóa cứng 1 máy
        if (!licenseData.machine_id || licenseData.machine_id === "") {
          licenseData.machine_id = machine_id;
          await env.LICENSES.put(license_key, JSON.stringify(licenseData));
        } else if (licenseData.machine_id !== machine_id) {
          return new Response(JSON.stringify({ success: false, message: "Mã bản quyền này đã được kích hoạt trên một máy tính khác!" }), { status: 403, headers: corsHeaders });
        }
      }

      // Trả về kết quả kèm theo cấp độ tài khoản (tier)
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Xác thực thành công!", 
        tier: licenseData.tier || "free" 
      }), { status: 200, headers: corsHeaders });
      
    } catch (err) {
      return new Response(JSON.stringify({ success: false, message: "Lỗi máy chủ cấp phép: " + err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
