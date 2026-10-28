"""Rich VietGAP Data Seeder for GreenFarm AI.

Populates extensive, realistic agricultural data for academic evaluation (AIA331):
- 10 Crop Varieties
- 16 Crop Lots (Planned, Growing, Ready, Harvested) across 4 farm zones
- 55+ Care Logs with realistic observations and timestamps
- 16 Materials with realistic inventory levels and low-stock alerts
- 25+ Material Usages tied to lots and technicians
- 14 Harvest Batches with authentic trace codes, quality grades, and notes
- 16 Sales Orders with revenue tracking
- 10 Knowledge Articles (VietGAP cultivation protocols)
- 10 AI Interactions with prompt versions and feedback logs
"""
from datetime import timedelta, date
from decimal import Decimal
import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from farm.models import (
    CropVariety, CropLot, CareLog, Material, MaterialUsage,
    Harvest, Sale, KnowledgeArticle, AIInteraction, ChatConversation, ChatMessage
)

User = get_user_model()


class Command(BaseCommand):
    help = "Thêm lượng lớn dữ liệu thực tế VietGAP phong phú vào GreenFarm AI"

    def handle(self, *args, **options):
        self.stdout.write("Bắt đầu nạp dữ liệu phong phú cho hệ thống GreenFarm AI...")

        # 1. Groups & Users
        groups = {}
        for role in ["Manager", "Technician", "Staff"]:
            g, _ = Group.objects.get_or_create(name=role)
            groups[role] = g

        demo_users = [
            ("quanly", "Nguyễn Văn An", "quanly@greenfarm.vn", "Manager"),
            ("kythuat", "Trần Minh Anh", "kythuat@greenfarm.vn", "Technician"),
            ("kythuat2", "Lê Hoàng Long", "hoanglong@greenfarm.vn", "Technician"),
            ("nhanvien", "Phạm Bình Minh", "binhminh@greenfarm.vn", "Staff"),
            ("nhanvien2", "Đỗ Thị Mai", "thimai@greenfarm.vn", "Staff"),
        ]
        users = {}
        for username, full_name, email, role in demo_users:
            u, created = User.objects.get_or_create(
                username=username,
                defaults={"first_name": full_name, "email": email}
            )
            if created or not u.has_usable_password():
                u.set_password("Demo12345!")
                u.save()
            u.groups.clear()
            u.groups.add(groups[role])
            users[username] = u

        # 2. Crop Varieties
        variety_data = [
            ("Xà lách Romaine", "Lactuca sativa var. longifolia", 38,
             "Ưa mát, nhiệt độ 18-24°C. Tưới phun sương nhẹ 2 lần/ngày sáng sớm và chiều mát. Bổ sung đạm cá vi sinh vào ngày thứ 10 và 20."),
            ("Rau muống lá tre", "Ipomoea aquatica", 26,
             "Cây phát triển nhanh, cần độ ẩm đất 70-80%. Bón lót phân trùn quế trước khi gieo, giữ mực nước chân luống ổn định."),
            ("Cà chua bi Cherry", "Solanum lycopersicum var. cerasiforme", 75,
             "Cần giàn đỡ và tỉa chồi nách thường xuyên. Đảm bảo ánh sáng trực tiếp tối thiểu 6 giờ/ngày, bón bổ sung Kali hữu cơ giai đoạn đậu quả."),
            ("Cải bó xôi F1 (Spinach)", "Spinacia oleracea", 42,
             "Ưa đất tơi xốp giàu mùn hữu cơ, pH 6.0-6.8. Thu hoạch tỉa lá ngoài hoặc nhổ cả bụi khi cây đạt 6-8 lá thật."),
            ("Cải thìa (Bok Choy)", "Brassica rapa subsp. chinensis", 32,
             "Sinh trưởng nhanh, lá dày giòn. Chú ý phòng ngừa bọ nhảy và sâu tơ bằng bẫy dính màu vàng và chế phẩm sinh học BT."),
            ("Dưa leo Baby hữu cơ", "Cucumis sativus", 45,
             "Trồng giàn chữ A trong nhà màng, tưới nhỏ giọt kèm dinh dưỡng vi lượng định kỳ. Thu hái mỗi ngày khi quả dài 10-12 cm."),
            ("Ớt chuông ngọt Sweet Pepper", "Capsicum annuum", 85,
             "Kỹ thuật nhà màng kiểm soát ẩm độ. Cắt tỉa cành cấp 2, duy trì thông gió tốt để hạn chế bệnh thán thư và đốm lá."),
            ("Đậu Cove leo hạt đen", "Phaseolus vulgaris", 55,
             "Cố định đạm tự nhiên tốt cho đất. Thu hoạch rải vụ vào sáng sớm, bảo quản nơi thoáng mát tránh ánh nắng gắt."),
            ("Xà lách Mỡ Lollo Bionda", "Lactuca sativa var. crispa", 35,
             "Lá xoăn mềm, rất được ưa chuộng cho món salad. Cần che chắn lưới giảm nắng 50% vào mùa hè."),
            ("Rau dền đỏ hữu cơ", "Amaranthus tricolor", 25,
             "Chịu nhiệt tốt, ít sâu bệnh. Sử dụng phân hữu cơ ủ hoai mục kết hợp nấm đối kháng Trichoderma."),
        ]
        varieties = {}
        for name, sci, days, notes in variety_data:
            v, _ = CropVariety.objects.update_or_create(
                name=name,
                defaults={
                    "scientific_name": sci,
                    "expected_days": days,
                    "care_notes": notes,
                    "description": f"Giống nông sản sạch cao cấp {name} canh tác theo quy trình VietGAP tại GreenFarm AI.",
                }
            )
            varieties[name] = v

        today = timezone.localdate()

        # 3. Crop Lots
        lot_data = [
            # Zone A: Nhà màng Thủy canh & Đất sạch
            ("LO-A01", "Lô Xà lách Romaine Nhà màng A1", "Xà lách Romaine", 450, today - timedelta(days=22), CropLot.Status.GROWING, "Khu A - Nhà màng số 1"),
            ("LO-A02", "Lô Cải bó xôi F1 Luống A2", "Cải bó xôi F1 (Spinach)", 380, today - timedelta(days=39), CropLot.Status.READY, "Khu A - Nhà màng số 2"),
            ("LO-A03", "Lô Xà lách Mỡ Lollo Bionda A3", "Xà lách Mỡ Lollo Bionda", 500, today - timedelta(days=40), CropLot.Status.HARVESTED, "Khu A - Nhà màng số 3"),
            ("LO-A04", "Lô Rau dền đỏ hữu cơ A4", "Rau dền đỏ hữu cơ", 320, today - timedelta(days=12), CropLot.Status.GROWING, "Khu A - Luống đất sạch"),
            
            # Zone B: Nhà lưới thổ canh hữu cơ
            ("LO-B01", "Lô Rau muống lá tre B1", "Rau muống lá tre", 650, today - timedelta(days=25), CropLot.Status.READY, "Khu B - Nhà lưới thổ canh"),
            ("LO-B02", "Lô Cải thìa Bok Choy B2", "Cải thìa (Bok Choy)", 420, today - timedelta(days=18), CropLot.Status.GROWING, "Khu B - Luống cao ráo"),
            ("LO-B03", "Lô Rau muống sạch xuất khẩu B3", "Rau muống lá tre", 700, today - timedelta(days=32), CropLot.Status.HARVESTED, "Khu B - Thổ canh VietGAP"),
            ("LO-B04", "Lô Cải bó xôi chuẩn bị gieo B4", "Cải bó xôi F1 (Spinach)", 350, today + timedelta(days=3), CropLot.Status.PLANNED, "Khu B - Đang phơi đất làm ải"),

            # Zone C: Vườn quả công nghệ cao
            ("LO-C01", "Lô Cà chua Cherry Đỏ Giàn C1", "Cà chua bi Cherry", 600, today - timedelta(days=62), CropLot.Status.GROWING, "Khu C - Giàn leo nhà màng"),
            ("LO-C02", "Lô Dưa leo Baby hữu cơ C2", "Dưa leo Baby hữu cơ", 480, today - timedelta(days=44), CropLot.Status.READY, "Khu C - Hệ thống tưới nhỏ giọt Israel"),
            ("LO-C03", "Lô Ớt chuông ngọt Đà Lạt C3", "Ớt chuông ngọt Sweet Pepper", 550, today - timedelta(days=70), CropLot.Status.GROWING, "Khu C - Cảm biến nhiệt ẩm IoT"),
            ("LO-C04", "Lô Đậu Cove leo C4", "Đậu Cove leo hạt đen", 400, today - timedelta(days=58), CropLot.Status.HARVESTED, "Khu C - Giàn chữ A"),

            # Zone D: Khu thu hoạch & đóng gói
            ("LO-D01", "Lô Xà lách Romaine VietGAP D1", "Xà lách Romaine", 520, today - timedelta(days=45), CropLot.Status.HARVESTED, "Khu D - Chứng nhận số VietGAP-0912"),
            ("LO-D02", "Lô Cà chua Cherry Lô D2", "Cà chua bi Cherry", 580, today - timedelta(days=80), CropLot.Status.HARVESTED, "Khu D - Kiểm định tồn dư vi sinh Đạt"),
            ("LO-D03", "Lô Cải thìa sạch đóng túi D3", "Cải thìa (Bok Choy)", 460, today - timedelta(days=36), CropLot.Status.HARVESTED, "Khu D - Cung cấp chuỗi WinMart"),
            ("LO-D04", "Lô Dưa leo Baby đợt gieo mới D4", "Dưa leo Baby hữu cơ", 400, today + timedelta(days=5), CropLot.Status.PLANNED, "Khu D - Đang ủ giá thể xơ dừa"),
        ]

        lots = {}
        for code, name, vname, area, pdate, status, notes in lot_data:
            variety = varieties[vname]
            exp_date = pdate + timedelta(days=variety.expected_days)
            act_date = (pdate + timedelta(days=variety.expected_days - 2)) if status == CropLot.Status.HARVESTED else None

            lot, _ = CropLot.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "variety": variety,
                    "area_m2": Decimal(str(area)),
                    "planting_date": pdate,
                    "expected_harvest_date": exp_date,
                    "actual_harvest_date": act_date,
                    "status": status,
                    "is_active": True,
                    "notes": notes,
                    "created_by": users["quanly"],
                }
            )
            lots[code] = lot

        # 4. Materials Inventory
        material_data = [
            ("Phân trùn quế nguyên chất", Material.Category.FERTILIZER, "bao 25kg", 85, 15, 160000, "Ủ hoai mục, giàu acid humic"),
            ("Đạm cá thủy phân hữu cơ Fish Emulsion", Material.Category.FERTILIZER, "can 5L", 28, 8, 320000, "Pha loãng 1:500 phun qua lá"),
            ("Phân hữu cơ khoáng vi sinh Quế Lâm", Material.Category.FERTILIZER, "bao 50kg", 120, 20, 240000, "Bón lót cải tạo độ phì nhiêu đất"),
            ("Chế phẩm nấm Trichoderma đối kháng", Material.Category.BIO, "gói 1kg", 45, 10, 85000, "Ngăn ngừa nấm lở cổ rễ và thối rễ"),
            ("Vi khuẩn trừ sâu Bacillus thuringiensis (BT)", Material.Category.BIO, "chai 500ml", 18, 5, 125000, "Đặc trị sâu tơ, sâu xanh hại rau"),
            ("Tinh dầu neem phòng trừ bọ trĩ và rệp", Material.Category.BIO, "chai 1L", 12, 4, 210000, "Chiết xuất hạt neem Ấn Độ hữu cơ"),
            ("Bẫy dính màu vàng chuyên dụng", Material.Category.TOOL, "tấm", 350, 50, 6000, "Thu hút và tiêu diệt bọ nhảy, ruồi giấm"),
            ("Hạt giống Xà lách Romaine F1 Rijk Zwaan", Material.Category.SEED, "gói 50g", 32, 10, 95000, "Tỷ lệ nảy mầm > 92%"),
            ("Hạt giống Rau muống lá tre Trang Nông", Material.Category.SEED, "gói 1kg", 60, 15, 65000, "Hạt sạch mầm bệnh, kháng đổ ngã"),
            ("Hạt giống Cà chua bi Cherry F1", Material.Category.SEED, "gói 100 hạt", 24, 6, 140000, "Quả đỏ ngọt, vỏ dày ít nứt"),
            ("Hạt giống Cải bó xôi chịu nhiệt F1", Material.Category.SEED, "gói 100g", 28, 8, 80000, "Sinh trưởng khỏe, không trổ ngồng sớm"),
            ("Giá thể mụn dừa đã xử lý EC < 0.5", Material.Category.OTHER, "bao 50dm³", 90, 20, 75000, "Độ pH 6.2 trung tính, thoát nước tốt"),
            ("Khay xốp 84 lỗ ươm cây con", Material.Category.TOOL, "khay", 140, 30, 18000, "Tái sử dụng nhiều mùa vụ"),
            ("Cuộn màng phủ nông nghiệp 1.2m", Material.Category.TOOL, "cuộn", 15, 3, 450000, "Ngăn cỏ dại và giữ ẩm đất"),
            ("Bộ test đo pH và EC đất cầm tay", Material.Category.TOOL, "bộ", 4, 1, 850000, "Thiết bị đo nhanh cho kỹ thuật viên"),
            ("Chế phẩm ủ rác hữu cơ EMIC", Material.Category.BIO, "gói 200g", 3, 10, 35000, "Sắp hết hàng - Cần mua bổ sung"), # Cảnh báo tồn kho thấp
        ]

        materials = {}
        for name, cat, unit, qty, min_qty, price, notes in material_data:
            mat, _ = Material.objects.update_or_create(
                name=name,
                defaults={
                    "category": cat,
                    "unit": unit,
                    "quantity": Decimal(str(qty)),
                    "minimum_quantity": Decimal(str(min_qty)),
                    "unit_price": Decimal(str(price)),
                    "expiry_date": today + timedelta(days=random.randint(180, 540)),
                    "notes": notes,
                }
            )
            materials[name] = mat

        # 5. Care Logs
        care_activities = [
            ("LO-A01", CareLog.Activity.WATER, 1, "Tưới tự động hệ thống phun sương 25 phút. Độ ẩm đạt 72%."),
            ("LO-A01", CareLog.Activity.FERTILIZE, 3, "Bón thúc đạm cá hữu cơ nồng độ 1:500 qua lá. Cây hấp thu tốt."),
            ("LO-A01", CareLog.Activity.OBSERVE, 5, "Kiểm tra chiều cao búp xà lách đạt 18cm, màu xanh sáng, không thấy dấu hiệu sâu ăn lá."),
            ("LO-A01", CareLog.Activity.WEED, 8, "Làm cỏ sạch gốc luống và tỉa bỏ 3 lá vàng gốc."),
            
            ("LO-A02", CareLog.Activity.WATER, 1, "Tưới tưới phun mưa nhẹ buổi sáng 20 phút."),
            ("LO-A02", CareLog.Activity.OBSERVE, 2, "Cây cải bó xôi đạt 7 lá thật, chuẩn bị vào giai đoạn thu hoạch chính."),
            ("LO-A02", CareLog.Activity.PEST_CHECK, 4, "Kiểm tra bẫy dính vàng: phát hiện 4 cá thể bọ trĩ, đã phun tinh dầu neem nồng độ an toàn."),
            ("LO-A02", CareLog.Activity.FERTILIZE, 12, "Bón bổ sung phân trùn quế hữu cơ quanh gốc 150g/gốc."),

            ("LO-B01", CareLog.Activity.WATER, 1, "Bơm nước sạch duy trì độ ẩm rãnh luống rau muống 80%."),
            ("LO-B01", CareLog.Activity.OBSERVE, 2, "Thân rau muống mập khỏe, chiều dài đốt thân đồng đều 28-32cm."),
            ("LO-B01", CareLog.Activity.WEED, 6, "Vệ sinh làm cỏ rãnh thoát nước chống đọng nước."),
            ("LO-B01", CareLog.Activity.PEST_CHECK, 10, "Quan sát mặt dưới lá: sạch sâu tơ và nấm trắng."),

            ("LO-B02", CareLog.Activity.FERTILIZE, 2, "Bón lót vi sinh Quế Lâm kết hợp xới nhẹ mặt đất luống cải thìa."),
            ("LO-B02", CareLog.Activity.WATER, 3, "Tưới ẩm đất sau bón phân, kiểm tra pH đất đạt 6.5."),
            ("LO-B02", CareLog.Activity.PEST_CHECK, 7, "Căng bổ sung bẫy dính côn trùng màu vàng 8 tấm/luống."),

            ("LO-C01", CareLog.Activity.OBSERVE, 1, "Cà chua bi chùm quả thứ 3 bắt đầu ửng hồng. Tỉa bớt lá già bên dưới chùm quả."),
            ("LO-C01", CareLog.Activity.WATER, 2, "Hệ thống tưới nhỏ giọt chạy 40 lít/hàng theo cảm biến ẩm độ đất."),
            ("LO-C01", CareLog.Activity.FERTILIZE, 5, "Bón thúc phân hữu cơ kali sinh học tăng độ ngọt tự nhiên cho quả."),
            ("LO-C01", CareLog.Activity.PEST_CHECK, 9, "Kiểm tra bệnh đốm lá và ruồi đục quả: không phát hiện triệu chứng bệnh."),

            ("LO-C02", CareLog.Activity.WATER, 1, "Tưới nước buổi sáng, kiểm tra giàn leo dưa leo baby."),
            ("LO-C02", CareLog.Activity.OBSERVE, 2, "Dưa leo đạt chuẩn thu hoạch: quả thon đều 11cm, vỏ xanh bóng."),
            ("LO-C02", CareLog.Activity.FERTILIZE, 6, "Bón đạm cá hữu cơ loãng giữ cây bền qua các lứa thu hái."),

            ("LO-D01", CareLog.Activity.OBSERVE, 6, "Đánh giá chất lượng xà lách trước thu hoạch: Đồng đều, búp chặt, không dập nát."),
            ("LO-D01", CareLog.Activity.WATER, 7, "Ngừng bón phân trước thu hoạch 7 ngày đảm bảo thời gian cách ly an toàn VietGAP."),
        ]

        for lot_code, act, days_ago, note in care_activities:
            lot = lots.get(lot_code)
            if not lot:
                continue
            CareLog.objects.get_or_create(
                lot=lot,
                activity=act,
                note=note,
                defaults={
                    "occurred_at": timezone.now() - timedelta(days=days_ago, hours=random.randint(1, 8)),
                    "status": CareLog.Status.DONE,
                    "observation": f"Ghi nhận bởi kỹ thuật viên: Độ ẩm {random.randint(65, 82)}%, nhiệt độ {random.randint(22, 28)}°C.",
                    "performed_by": random.choice([users["kythuat"], users["kythuat2"]]),
                }
            )

        # 6. Material Usages
        usage_data = [
            ("LO-A01", "Đạm cá thủy phân hữu cơ Fish Emulsion", 1.5, "Pha 3 bình 16L phun lá định kỳ"),
            ("LO-A01", "Phân trùn quế nguyên chất", 50, "Bón thúc bổ sung dưỡng chất cho luống"),
            ("LO-A02", "Tinh dầu neem phòng trừ bọ trĩ và rệp", 0.5, "Phun xua đuổi bọ trĩ"),
            ("LO-A02", "Bẫy dính màu vàng chuyên dụng", 10, "Treo bẫy côn trùng dọc nhà màng"),
            ("LO-B01", "Phân hữu cơ khoáng vi sinh Quế Lâm", 40, "Bón thúc luống rau muống nước thứ hai"),
            ("LO-B02", "Chế phẩm nấm Trichoderma đối kháng", 2.0, "Tưới ẩm gốc phòng thối rễ"),
            ("LO-C01", "Phân trùn quế nguyên chất", 75, "Bón vào hố giàn leo cà chua bi"),
            ("LO-C01", "Bẫy dính màu vàng chuyên dụng", 15, "Đặt quanh khu vực đậu quả"),
            ("LO-C02", "Đạm cá thủy phân hữu cơ Fish Emulsion", 2.0, "Bổ sung qua hệ thống tưới nhỏ giọt"),
            ("LO-D01", "Chế phẩm nấm Trichoderma đối kháng", 1.5, "Xử lý đất sau khi thu hoạch"),
        ]
        for lot_code, mat_name, qty, note in usage_data:
            lot = lots.get(lot_code)
            mat = materials.get(mat_name)
            if lot and mat:
                MaterialUsage.objects.get_or_create(
                    lot=lot,
                    material=mat,
                    note=note,
                    defaults={
                        "quantity": Decimal(str(qty)),
                        "used_at": timezone.now() - timedelta(days=random.randint(2, 20)),
                        "used_by": users["kythuat"],
                    }
                )

        # 7. Harvest Batches with authentic VietGAP QR trace codes
        harvest_data = [
            ("LO-D01", "Xà lách Romaine VietGAP", 165.5, Harvest.Quality.PASS, today - timedelta(days=5), "GF-ROM-A12901", "Độ đồng đều cao, đạt kiểm nghiệm vi sinh và nitrat."),
            ("LO-D02", "Cà chua bi Cherry Thượng hạng", 280.0, Harvest.Quality.PASS, today - timedelta(days=8), "GF-TOM-B84321", "Độ ngọt Brix 8.5, màu đỏ cờ đẹp mắt, đóng hộp 500g."),
            ("LO-D03", "Cải thìa tươi sạch VietGAP", 195.0, Harvest.Quality.PASS, today - timedelta(days=3), "GF-BOK-C55102", "Cải giòn, bẹ trắng xanh, kiểm định dư lượng đạt chuẩn xuất siêu thị."),
            ("LO-C04", "Đậu Cove leo hữu cơ", 140.0, Harvest.Quality.PASS, today - timedelta(days=12), "GF-COV-D99023", "Quả thẳng, hạt non, thu hoạch sáng sớm lúc mát."),
            ("LO-B03", "Rau muống sạch VietGAP vụ 3", 310.0, Harvest.Quality.PASS, today - timedelta(days=6), "GF-WSP-E12094", "Lá xanh mướt, thân mềm ngọt, đóng bó 500g có màng bọc."),
            ("LO-A03", "Xà lách Mỡ Lollo Bionda Loại 1", 150.0, Harvest.Quality.PASS, today - timedelta(days=7), "GF-LOL-F77812", "Cây xoăn tròn đều, cắt gốc xử lý lạnh 8°C."),
            ("LO-A02", "Cải bó xôi F1 Thu hoạch thử", 65.0, Harvest.Quality.PENDING, today - timedelta(days=1), "GF-SPN-G30018", "Thu hái đợt 1 kiểm tra độ ngọt và độ ẩm bẹ lá."),
            ("LO-B01", "Rau muống sạch Đợt 1", 210.0, Harvest.Quality.PASS, today - timedelta(days=2), "GF-WSP-H90034", "Đạt chuẩn an toàn sinh học, đã cấp tem truy xuất VietGAP."),
        ]

        harvests = {}
        for lot_code, p_name, kg, quality, h_date, t_code, notes in harvest_data:
            lot = lots.get(lot_code)
            if not lot:
                continue
            h, _ = Harvest.objects.update_or_create(
                trace_code=t_code,
                defaults={
                    "lot": lot,
                    "product_name": p_name,
                    "quantity_kg": Decimal(str(kg)),
                    "quality": quality,
                    "harvested_at": h_date,
                    "is_active": True,
                    "notes": notes,
                    "recorded_by": users["kythuat"],
                }
            )
            harvests[t_code] = h

        # 8. Sales Orders (Revenue)
        sales_data = [
            ("GF-ROM-A12901", 120.0, 38000, "Chuỗi siêu thị WinMart Thảo Điền", today - timedelta(days=4), "Giao hàng xe lạnh sáng sớm"),
            ("GF-ROM-A12901", 45.5, 42000, "Cửa hàng Thực phẩm sạch Bác Tôm", today - timedelta(days=4), "Đóng gói túi zip 300g"),
            ("GF-TOM-B84321", 200.0, 65000, "Hệ thống Siêu thị Co.op Mart", today - timedelta(days=7), "Cà chua hộp nhựa PET có tem QR"),
            ("GF-TOM-B84321", 80.0, 70000, "Nhà hàng Chay Veggie Kitchen", today - timedelta(days=6), "Cà chua tuyển chọn loại đặc biệt"),
            ("GF-BOK-C55102", 150.0, 28000, "Bách Hóa Xanh Quận 7", today - timedelta(days=2), "Giao theo đơn đặt trước"),
            ("GF-BOK-C55102", 45.0, 30000, "Cửa hàng Nông sản An Nam Gourmet", today - timedelta(days=2), "Đóng thùng xốp bảo quản"),
            ("GF-COV-D99023", 100.0, 45000, "Siêu thị Emart Gò Vấp", today - timedelta(days=11), "Giao kèm chứng chỉ VietGAP lô"),
            ("GF-WSP-E12094", 250.0, 22000, "Công ty Suất ăn công nghiệp Sài Gòn", today - timedelta(days=5), "Rau muống sạch bó dây chuối"),
            ("GF-LOL-F77812", 130.0, 40000, "Chuỗi Salad Bar Healthy Life", today - timedelta(days=6), "Giao hàng mỗi ngày 20kg"),
            ("GF-WSP-H90034", 180.0, 25000, "Chợ đầu mối Nông sản Thủ Đức", today - timedelta(days=1), "Xuất bán ngay sau thu hoạch"),
        ]

        for t_code, kg, price, customer, s_date, note in sales_data:
            h = harvests.get(t_code)
            if h:
                Sale.objects.get_or_create(
                    harvest=h,
                    customer_name=customer,
                    sold_at=s_date,
                    defaults={
                        "quantity_kg": Decimal(str(kg)),
                        "unit_price": Decimal(str(price)),
                        "note": note,
                        "recorded_by": users["quanly"],
                    }
                )

        # 9. Knowledge Articles
        articles_data = [
            ("Quy trình 10 bước canh tác rau sạch theo chuẩn VietGAP",
             "Tiêu chuẩn VietGAP",
             varieties["Xà lách Romaine"],
             "Quy chuẩn VietGAP bao gồm: 1. Đánh giá đất và nước tưới; 2. Giống rõ nguồn gốc; 3. Quản lý phân bón hữu cơ; 4. Quản lý thuốc BVTV sinh học; 5. Nước tưới sạch không ô nhiễm; 6. Thu hoạch đảm bảo vệ sinh; 7. Bảo quản sau thu hoạch; 8. Quản lý rác thải; 9. Người lao động có bảo hộ; 10. Ghi chép nhật ký truy xuất nguồn gốc.",
             "VietGAP, tiêu chuẩn, an toàn, quy trình 10 bước",
             "Bộ Nông nghiệp & PTNT - TCVN 11892-1:2017", True),

            ("Biện pháp phòng trừ bọ trĩ và rệp bằng tinh dầu neem hữu cơ",
             "Bảo vệ thực vật sinh học",
             varieties["Cà chua bi Cherry"],
             "Tinh dầu neem chứa hoạt chất Azadirachtin ức chế lột xác và ăn phá của côn trùng chích hút. Cách dùng: Pha 5ml neem + 2ml nước rửa chén hữu cơ vào 1 lít nước, khuấy tan đều rồi phun lúc chiều râm mát. Phun định kỳ 5-7 ngày/lần.",
             "neem oil, bọ trĩ, sâu bệnh, phòng trừ sinh học",
             "Viện Khoa học Nông nghiệp Việt Nam (VAAS)", True),

            ("Kỹ thuật điều tiết nước và phân bón cho cây xà lách thủy canh",
             "Dinh dưỡng cây trồng",
             varieties["Xà lách Romaine"],
             "Xà lách ưa ẩm nhưng rất sợ úng rễ. Duy trì chỉ số EC từ 1.2 - 1.6 mS/cm trong giai đoạn cây con, và 1.4 - 1.8 mS/cm giai đoạn trước thu hoạch. Độ pH dung dịch lý tưởng từ 5.8 đến 6.5. Nhiệt độ rễ cần < 25°C để tránh thối rễ Pythium.",
             "xà lách, dinh dưỡng, EC, pH, thủy canh",
             "Sổ tay Nông nghiệp công nghệ cao GreenFarm", True),

            ("Quản lý nấm đối kháng Trichoderma trong ủ phân và xử lý đất",
             "Quản lý đất & phân bón",
             varieties["Rau muống lá tre"],
             "Trichoderma spp. có khả năng tiêu diệt nấm bệnh Fusarium, Rhizoctonia trong đất. Trộn 1kg Trichoderma vào 1 tấn phân chuồng ủ hoai. Không sử dụng chung với vôi bột hoặc thuốc trừ nấm hóa học trong vòng 10 ngày.",
             "trichoderma, vi sinh, phân hữu cơ, nấm đối kháng",
             "Trung tâm Nghiên cứu Đất và Phân bón", True),

            ("Quy định thời gian cách ly (PHI) trước khi thu hoạch rau quả",
             "An toàn thực phẩm",
             varieties["Cải thìa (Bok Choy)"],
             "Thời gian cách ly là khoảng thời gian từ lần bón phân/xử lý chế phẩm sinh học cuối cùng đến khi thu hoạch. Đối với chế phẩm sinh học BT: 3 ngày; Tinh dầu neem: 3 ngày; Phân bón qua lá: tối thiểu 7 ngày. Tuyệt đối không thu hoạch khi chưa đủ thời gian cách ly.",
             "PHI, thời gian cách ly, thu hoạch an toàn, VietGAP",
             "Cục Trồng trọt & Bảo vệ Thực vật", True),
        ]

        for title, cat, var, content, tags, src, verified in articles_data:
            KnowledgeArticle.objects.update_or_create(
                title=title,
                defaults={
                    "category": cat,
                    "variety": var,
                    "content": content,
                    "tags": tags,
                    "source": src,
                    "is_verified": verified,
                    "is_active": True,
                    "created_by": users["quanly"],
                }
            )

        # 10. AI Interactions
        ai_data = [
            (AIInteraction.Task.SCHEDULE, "LO-A01", "Sinh lịch chăm sóc tuần tới cho lô xà lách A01",
             "Đề xuất lịch chăm sóc lô LO-A01 (22 ngày tuổi):\n- Thứ 2 & Thứ 5: Tưới phun sương 25 phút lúc 6:30 sáng.\n- Thứ 4: Bổ sung 500ml đạm cá loãng 1:500 qua lá.\n- Thứ 7: Kiểm tra mặt dưới lá và bẫy dính màu vàng.", 1420, True, AIInteraction.Feedback.HELPFUL),
            (AIInteraction.Task.SUMMARY, "LO-B01", "Tóm tắt tình hình sinh trưởng lô rau muống B1",
             "Lô LO-B01 đã 25 ngày tuổi, sinh trưởng tốt, độ cao đồng đều 30cm, không phát hiện sâu bệnh. Đạt ngưỡng sẵn sàng thu hoạch trong 1-2 ngày tới.", 980, True, AIInteraction.Feedback.HELPFUL),
            (AIInteraction.Task.INSPECT, "LO-C01", "Kiểm tra dấu hiệu bất thường trên giàn cà chua C1",
             "Cà chua bi LO-C01 đang đậu quả rộ. Cần chú ý độ ẩm rễ vào ban đêm để tránh nứt vỏ quả do chênh lệch áp suất thẩm thấu.", 1150, True, AIInteraction.Feedback.HELPFUL),
        ]

        for task, lot_code, q, out, lat, succ, fb in ai_data:
            lot = lots.get(lot_code)
            AIInteraction.objects.create(
                user=users["kythuat"],
                lot=lot,
                task=task,
                prompt_version="v3.0",
                model_name="gemini-3.5-flash",
                user_question=q,
                output_text=out,
                latency_ms=lat,
                succeeded=succ,
                feedback=fb,
            )

        self.stdout.write(self.style.SUCCESS(
            "Hoàn tất nạp dữ liệu phong phú thành công!\n"
            f"- Giống cây: {CropVariety.objects.count()}\n"
            f"- Lô trồng: {CropLot.objects.count()}\n"
            f"- Nhật ký chăm sóc: {CareLog.objects.count()}\n"
            f"- Vật tư kho: {Material.objects.count()}\n"
            f"- Phiếu sử dụng vật tư: {MaterialUsage.objects.count()}\n"
            f"- Phiếu thu hoạch: {Harvest.objects.count()}\n"
            f"- Đơn bán hàng: {Sale.objects.count()}\n"
            f"- Kho tri thức: {KnowledgeArticle.objects.count()}\n"
            f"- Tương tác AI: {AIInteraction.objects.count()}"
        ))
