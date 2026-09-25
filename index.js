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

      // 1. Lấy thông báo khuyến mãi chung từ KV (Key: GLOBAL_ANNOUNCEMENT)
      let globalAnnouncement = "Chào mừng bạn đến với 3DAi Studio!";
      try {
        const annDataStr = await env.LICENSES.get("GLOBAL_ANNOUNCEMENT");
        if (annDataStr) {
          const annObj = JSON.parse(annDataStr);
          if (annObj.message) {
            globalAnnouncement = annObj.message;
          }
        }
      } catch (e) {
        // Bỏ qua lỗi đọc announcement nếu chưa tạo
      }

      // 2. Tìm Key bản quyền của người dùng trong KV
      const licenseDataStr = await env.LICENSES.get(license_key);
      if (!licenseDataStr) {
        return new Response(JSON.stringify({ success: false, message: "Mã bản quyền không tồn tại trên hệ thống!" }), { status: 404, headers: corsHeaders });
      }

      let licenseData = JSON.parse(licenseDataStr);
      
      // Kiểm tra trạng thái Key
      if (licenseData.status !== "active") {
        return new Response(JSON.stringify({ success: false, message: "Mã bản quyền đã bị khóa hoặc ngừng hoạt động!" }), { status: 403, headers: corsHeaders });
      }

      // Kiểm tra thời hạn
      if (licenseData.expiry_date) {
        const today = new Date().toISOString().split('T')[0];
        if (today > licenseData.expiry_date) {
          return new Response(JSON.stringify({ success: false, message: "Mã bản quyền đã hết hạn sử dụng!" }), { status: 403, headers: corsHeaders });
        }
      }

      // Phân biệt loại Key: Dùng chung (shared) hay Cá nhân (personal)
      if (licenseData.type === "shared") {
        // Không khóa máy
      } else {
        if (!licenseData.machine_id || licenseData.machine_id === "") {
          licenseData.machine_id = machine_id;
          await env.LICENSES.put(license_key, JSON.stringify(licenseData));
        } else if (licenseData.machine_id !== machine_id) {
          return new Response(JSON.stringify({ success: false, message: "Mã bản quyền này đã được sử dụng trên một máy tính khác!" }), { status: 403, headers: corsHeaders });
        }
      }

      // 3. Trả về kết quả kèm theo thông báo khuyến mãi chung
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Xác thực bản quyền thành công!", 
        tier: licenseData.tier || "free",
        announcement: globalAnnouncement 
      }), { status: 200, headers: corsHeaders });
      
    } catch (err) {
      return new Response(JSON.stringify({ success: false, message: "Lỗi máy chủ cấp phép: " + err.message }), { status: 500, headers: corsHeaders });
    }
  }
};
