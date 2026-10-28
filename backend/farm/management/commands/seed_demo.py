from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from farm.models import CropVariety, CropLot, CareLog, Material, MaterialUsage, Harvest, Sale, KnowledgeArticle

User = get_user_model()

class Command(BaseCommand):
    help = "Tạo dữ liệu và tài khoản demo GreenFarm AI. Chỉ dùng ở môi trường học tập."

    def handle(self, *args, **options):
        for group_name in ["Manager", "Technician", "Staff"]:
            Group.objects.get_or_create(name=group_name)
        demo_users = [
            ("quanly", "Văn An", "quanly@greenfarm.local", "Manager"),
            ("kythuat", "Minh Anh", "kythuat@greenfarm.local", "Technician"),
            ("nhanvien", "Bình Minh", "nhanvien@greenfarm.local", "Staff"),
        ]
        users = {}
        for username, full_name, email, role in demo_users:
            user, created = User.objects.get_or_create(username=username, defaults={"first_name": full_name, "email": email})
            if created:
                user.set_password("Demo12345!"); user.save()
            user.groups.clear(); user.groups.add(Group.objects.get(name=role)); users[username] = user

        variety_specs = [
            ("Xà lách", "Lactuca sativa", 35, "Quan sát sinh trưởng, độ ẩm và tình trạng lá; kiểm chứng lịch chăm sóc với người có chuyên môn."),
            ("Rau muống", "Ipomoea aquatica", 28, "Theo dõi điều kiện nước và sinh trưởng thực tế; ghi nhật ký đầy đủ."),
            ("Cà chua", "Solanum lycopersicum", 75, "Theo dõi sinh trưởng, dấu hiệu sâu bệnh và tình trạng quả."),
            ("Cải bó xôi", "Spinacia oleracea", 40, "Theo dõi lá, đất và lịch chăm sóc theo hướng dẫn phù hợp."),
            ("Cải thảo", "Brassica rapa subsp. pekinensis", 60, "Quan sát lá và dấu hiệu bất thường, không kết luận bệnh khi thiếu kiểm tra."),
        ]
        varieties = {}
        for name, science, days, notes in variety_specs:
            obj, _ = CropVariety.objects.get_or_create(name=name, defaults={"scientific_name": science, "expected_days": days, "care_notes": notes, "description": f"Giống cây {name} dùng trong dữ liệu minh họa GreenFarm."})
            varieties[name] = obj

        today = timezone.localdate()
        lot_specs = [
            ("A01", "Lô rau xà lách", "Xà lách", 500, today - timedelta(days=18), CropLot.Status.GROWING),
            ("A02", "Lô cải bó xôi", "Cải bó xôi", 300, today - timedelta(days=31), CropLot.Status.READY),
            ("B01", "Lô rau muống", "Rau muống", 600, today - timedelta(days=24), CropLot.Status.READY),
            ("B02", "Lô cải thảo", "Cải thảo", 400, today - timedelta(days=10), CropLot.Status.GROWING),
            ("C01", "Lô cà chua", "Cà chua", 500, today - timedelta(days=50), CropLot.Status.GROWING),
            ("D01", "Lô xà lách đã thu hoạch", "Xà lách", 350, today - timedelta(days=45), CropLot.Status.HARVESTED),
        ]
        lots = {}
        for code, name, vname, area, planted, status in lot_specs:
            obj, _ = CropLot.objects.get_or_create(code=code, defaults={
                "name": name, "variety": varieties[vname], "area_m2": Decimal(str(area)),
                "planting_date": planted, "expected_harvest_date": planted + timedelta(days=varieties[vname].expected_days),
                "status": status, "notes": "Dữ liệu mẫu cho học phần AIA331; cần thay bằng dữ liệu thực tế.",
                "created_by": users["quanly"],
            })
            lots[code] = obj

        log_specs = [
            ("A01", CareLog.Activity.WATER, timezone.now() - timedelta(hours=2), CareLog.Status.DONE, "Đã tưới theo lịch của lô.", "Độ ẩm đất cần được đo/kiểm tra thực tế."),
            ("A01", CareLog.Activity.OBSERVE, timezone.now() - timedelta(hours=1), CareLog.Status.DONE, "Ghi nhận sinh trưởng định kỳ.", "Chưa có ảnh hoặc thông số đo kèm theo."),
            ("B02", CareLog.Activity.FERTILIZE, timezone.now() - timedelta(days=1), CareLog.Status.TODO, "Đối chiếu kế hoạch bón phân.", "Chưa xác nhận việc thực hiện."),
            ("C01", CareLog.Activity.PEST_CHECK, timezone.now() - timedelta(days=1), CareLog.Status.TODO, "Kiểm tra mặt trên và dưới lá.", "Chưa có kết quả kiểm tra."),
        ]
        for code, activity, at, status, note, obs in log_specs:
            exists = CareLog.objects.filter(lot=lots[code], activity=activity, note=note).exists()
            if not exists:
                CareLog.objects.create(lot=lots[code], activity=activity, occurred_at=at, status=status,
                                       note=note, observation=obs, performed_by=users["kythuat"])

        material_specs = [
            ("Phân hữu cơ", Material.Category.FERTILIZER, "bao", 50, 8, 120000),
            ("Phân NPK", Material.Category.FERTILIZER, "kg", 200, 20, 35000),
            ("Chế phẩm sinh học", Material.Category.BIO, "chai", 15, 5, 85000),
            ("Hạt giống xà lách", Material.Category.SEED, "gói", 100, 20, 45000),
        ]
        mats = {}
        for name, category, unit, quantity, minimum, price in material_specs:
            mat, _ = Material.objects.get_or_create(name=name, defaults={"category": category, "unit": unit, "quantity": quantity, "minimum_quantity": minimum, "unit_price": price})
            mats[name] = mat

        harvest_specs = [
            ("D01", "Rau xà lách", Decimal("85.5"), Harvest.Quality.PASS, today - timedelta(days=5)),
            ("B01", "Rau muống", Decimal("120"), Harvest.Quality.PENDING, today - timedelta(days=1)),
        ]
        harvests = []
        for code, product, kg, quality, date in harvest_specs:
            h, created = Harvest.objects.get_or_create(lot=lots[code], product_name=product, harvested_at=date, defaults={"quantity_kg": kg, "quality": quality, "recorded_by": users["kythuat"], "notes": "Mẫu minh họa, xác nhận chất lượng trước khi xuất bán."})
            harvests.append(h)
        if harvests:
            Sale.objects.get_or_create(harvest=harvests[0], sold_at=today - timedelta(days=4), defaults={"quantity_kg": Decimal("20"), "unit_price": Decimal("30000"), "customer_name": "Cửa hàng rau sạch mẫu", "recorded_by": users["quanly"]})

        articles = [
            ("Theo dõi xà lách theo lô", "Xà lách", "Xà lách; nhật ký; độ ẩm", "Theo dõi thực tế các dấu hiệu sinh trưởng và ghi nhật ký theo ngày. Kiểm tra điều kiện đất, nước và lá trước khi thay đổi lịch chăm sóc. Nội dung này chỉ là khung ghi nhận, không phải quy trình định lượng.", "Tài liệu demo nội bộ", False),
            ("Ghi nhận rau muống", "Rau muống", "rau muống; nước; sinh trưởng", "Ghi lại ngày chăm sóc, tình trạng cây, điều kiện nước và các dấu hiệu quan sát được. Không đưa ra kết luận khi thiếu số đo hoặc kiểm tra trực tiếp.", "Tài liệu demo nội bộ", False),
            ("Kiểm tra cây cà chua", "Cà chua", "cà chua; lá; sâu bệnh; thu hoạch", "Quan sát lá, thân, quả và ghi hình/ghi chú biểu hiện bất thường. Khi nghi ngờ sâu bệnh, cần người có chuyên môn đánh giá trước khi sử dụng biện pháp xử lý.", "Tài liệu demo nội bộ", False),
            ("Nguyên tắc nhật ký chăm sóc", None, "nhật ký; tưới; bón phân; sâu bệnh", "Mỗi nhật ký nên ghi lô trồng, thời gian, công việc, người thực hiện, vật tư liên quan và quan sát thực tế. Tách dữ liệu quan sát khỏi suy đoán. Nhật ký thiếu dữ liệu cần được bổ sung trước khi đưa ra khuyến nghị.", "Quy ước dữ liệu demo", False),
            ("Nguyên tắc kiểm tra trước thu hoạch", None, "thu hoạch; chất lượng; nguồn gốc", "Đối chiếu mã lô, ngày gieo, nhật ký và tình trạng thực tế. Chỉ ghi nhận kết quả sau khi người có trách nhiệm kiểm tra; không xem dự đoán của AI là xác nhận chất lượng.", "Quy ước dữ liệu demo", False),
        ]
        for title, vname, tags, content, source, verified in articles:
            KnowledgeArticle.objects.get_or_create(title=title, defaults={"variety": varieties.get(vname) if vname else None, "category": "Quy trình tham khảo", "tags": tags, "content": content, "source": source, "is_verified": verified, "created_by": users["quanly"]})

        self.stdout.write(self.style.SUCCESS("Đã khởi tạo dữ liệu demo GreenFarm AI."))
        self.stdout.write("Tài khoản demo (chỉ dùng local): quanly / kythuat / nhanvien — mật khẩu Demo12345!")
