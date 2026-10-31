import { CategoryDetail, MenuCategoryId } from '../types/menu';

// Nội dung "Mô tả sản phẩm & Nguồn gốc" dùng chung theo danh mục.
// Khi backend có dữ liệu riêng cho từng món thì thay bằng API.
export const CATEGORY_DETAILS: Record<MenuCategoryId, CategoryDetail> = {
  'ca-phe': {
    series: 'Signature Series',
    tags: [
      { label: 'Pha Phin Truyền Thống', icon: 'coffee' },
      { label: 'Robusta & Arabica Blend', icon: 'leaf' },
      { label: 'Đậm đà caffeine', icon: 'zap' },
    ],
    story: {
      ingredients:
        'Hạt Robusta Buôn Ma Thuột kết hợp Arabica Cầu Đất, sữa đặc cao cấp, đá viên tinh khiết từ nước lọc thẩm thấu ngược.',
      origin:
        'Đắk Lắk & Lâm Đồng, Việt Nam. Vùng canh tác ở độ cao 1.200m – 1.500m so với mực nước biển, thổ nhưỡng bazan màu mỡ.',
      flavor:
        'Vị đắng thanh đậm đà từ hạt Robusta rang vừa, hậu vị ngọt caramen kéo dài, quyện cùng độ béo dịu của sữa.',
      serving:
        'Dùng ngon nhất trong 20 phút sau khi pha. Khuấy đều đáy ly theo vòng xoay để sữa và cà phê hòa quyện trọn vẹn.',
    },
    flavor: [
      { label: 'Độ Đậm (Intensity)', score: 9 },
      { label: 'Độ Béo Ngọt (Sweetness)', score: 7.5 },
      { label: 'Hương Thơm (Aroma)', score: 8.5 },
    ],
  },
  'cold-brew': {
    series: 'Slow Brew Series',
    tags: [
      { label: 'Ủ lạnh 16 giờ', icon: 'clock' },
      { label: 'Arabica Cầu Đất', icon: 'leaf' },
      { label: 'Ít chua, êm dịu', icon: 'snowflake' },
    ],
    story: {
      ingredients:
        'Arabica Cầu Đất xay thô ngâm trong nước lọc lạnh 16 giờ, lọc hai lần qua giấy để giữ vị trong trẻo.',
      origin: 'Cầu Đất, Đà Lạt — độ cao 1.650m, khí hậu mát quanh năm giúp hạt chín chậm và tích nhiều đường tự nhiên.',
      flavor: 'Nốt chocolate đen, hạt dẻ và cam chín; độ chua thấp hơn 60% so với cà phê pha nóng.',
      serving: 'Uống lạnh trực tiếp hoặc thêm đá viên lớn để không bị loãng. Bảo quản lạnh, dùng trong ngày.',
    },
    flavor: [
      { label: 'Độ Đậm (Intensity)', score: 7.5 },
      { label: 'Độ Ngọt Tự Nhiên', score: 6 },
      { label: 'Hương Thơm (Aroma)', score: 9 },
    ],
  },
  'tra-sua': {
    series: 'Milk Tea Series',
    tags: [
      { label: 'Trà ủ mới mỗi 4 giờ', icon: 'clock' },
      { label: 'Sữa tươi thanh trùng', icon: 'milk' },
      { label: 'Topping nấu thủ công', icon: 'sparkles' },
    ],
    story: {
      ingredients: 'Lá trà Assam/Oolong chọn lọc, sữa tươi thanh trùng Đà Lạt, đường mía nguyên chất và topping nấu trong ngày.',
      origin: 'Trà từ đồi chè Bảo Lộc và Thái Nguyên, sấy và ủ tại xưởng BrewLite trước khi pha.',
      flavor: 'Vị trà đậm, chát nhẹ ở đầu lưỡi, hậu béo thơm của sữa tươi và vị ngọt caramel dịu.',
      serving: 'Lắc đều ly trước khi uống để lớp sữa và trà hòa quyện. Ngon nhất khi dùng trong 30 phút.',
    },
    flavor: [
      { label: 'Độ Đậm Trà', score: 8 },
      { label: 'Độ Béo Ngọt', score: 8 },
      { label: 'Hương Thơm', score: 7.5 },
    ],
  },
  'tra-matcha': {
    series: 'Tea House Series',
    tags: [
      { label: 'Lá trà nguyên chất', icon: 'leaf' },
      { label: 'Pha ấm thủ công', icon: 'droplets' },
      { label: 'Ít caffeine', icon: 'flower' },
    ],
    story: {
      ingredients: 'Matcha Uji Nhật Bản, trà Ô long Bảo Lộc, thảo mộc sấy khô tự nhiên, không hương liệu tổng hợp.',
      origin: 'Uji (Kyoto, Nhật Bản) và cao nguyên Bảo Lộc, Lâm Đồng — hai vùng trà nổi tiếng với sương mù quanh năm.',
      flavor: 'Chát nhẹ, thanh mát, hậu ngọt sâu và hương cỏ non tươi đặc trưng của lá trà mới.',
      serving: 'Thưởng thức chậm rãi khi còn ấm, hoặc kết hợp cùng bánh ngọt ít đường để cân bằng vị.',
    },
    flavor: [
      { label: 'Độ Chát (Body)', score: 6.5 },
      { label: 'Độ Ngọt Hậu', score: 7 },
      { label: 'Hương Thơm', score: 9 },
    ],
  },
  'tra-trai-cay': {
    series: 'Fresh Fruit Series',
    tags: [
      { label: 'Trái cây tươi mỗi ngày', icon: 'citrus' },
      { label: 'Trà ủ lạnh', icon: 'snowflake' },
      { label: 'Thanh nhiệt', icon: 'leaf' },
    ],
    story: {
      ingredients: 'Cốt trà đen/trà lài ủ lạnh, trái cây tươi sơ chế trong ngày, đường phèn và đá viên tinh khiết.',
      origin: 'Trái cây từ nhà vườn Tiền Giang, Đồng Tháp và Đà Lạt, giao về cửa hàng mỗi sáng sớm.',
      flavor: 'Chua ngọt hài hòa, mùi thơm trái chín tự nhiên trên nền trà thanh mát, không gắt.',
      serving: 'Khuấy nhẹ để trái cây tiết hương. Ngon nhất khi còn đá, trong vòng 30 phút.',
    },
    flavor: [
      { label: 'Độ Chua Thanh', score: 7 },
      { label: 'Độ Ngọt', score: 6.5 },
      { label: 'Hương Trái Cây', score: 9 },
    ],
  },
  cacao: {
    series: 'Cocoa Series',
    tags: [
      { label: 'Cacao Đắk Lắk', icon: 'leaf' },
      { label: 'Sữa tươi béo', icon: 'milk' },
      { label: 'Nạp năng lượng', icon: 'zap' },
    ],
    story: {
      ingredients: 'Bột cacao nguyên chất lên men tự nhiên, socola Bỉ 54%, sữa tươi và kem tươi đánh bông.',
      origin: 'Cacao trồng xen canh ở Đắk Lắk và Bến Tre, lên men 6 ngày để phát triển hương vị sâu.',
      flavor: 'Đắng nhẹ của cacao, ngọt béo của sữa, hậu vị chocolate kéo dài và hơi bùi.',
      serving: 'Dùng nóng khi trời se lạnh hoặc đá xay cho buổi chiều. Khuấy đều lớp cacao lắng ở đáy ly.',
    },
    flavor: [
      { label: 'Độ Đậm Cacao', score: 8.5 },
      { label: 'Độ Béo Ngọt', score: 8.5 },
      { label: 'Hương Thơm', score: 7.5 },
    ],
  },
  'giai-nhiet': {
    series: 'Refresh Series',
    tags: [
      { label: 'Ép/xay tươi tại quầy', icon: 'citrus' },
      { label: 'Không chất bảo quản', icon: 'leaf' },
      { label: 'Giàu vitamin', icon: 'sparkles' },
    ],
    story: {
      ingredients: 'Trái cây tươi nguyên quả, sữa chua tự làm, mật ong rừng và đá viên tinh khiết.',
      origin: 'Nguồn trái cây theo mùa từ các nhà vườn đạt chuẩn VietGAP ở miền Tây và Lâm Đồng.',
      flavor: 'Tươi mát, ngọt tự nhiên từ trái chín, kết cấu sánh mịn và thanh nhẹ.',
      serving: 'Uống ngay sau khi nhận để giữ trọn vitamin và màu sắc tự nhiên của trái cây.',
    },
    flavor: [
      { label: 'Độ Tươi Mát', score: 9 },
      { label: 'Độ Ngọt Tự Nhiên', score: 7 },
      { label: 'Độ Sánh', score: 7.5 },
    ],
  },
};
