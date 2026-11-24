// ============================================================
//  HUMO ARENA 3D — sozlamalar (chipta sotuvchi shu faylni o'zgartiradi)
// ============================================================
export const CONFIG = {
  venueName: 'HUMO ARENA',
  city: 'Toshkent',
  currency: { uz: "so'm", ru: 'сум', en: 'UZS' },
  maxSeatsPerOrder: 10,

  // Narx toifalari. color — 3D xaritadagi o'rindiq rangi.
  categories: {
    vip:       { name: { uz: 'VIP loja',     ru: 'VIP ложа',     en: 'VIP Lodge' },   color: '#e8743b', price: 2500000 },
    parter_a:  { name: { uz: 'Parter A',     ru: 'Партер A',     en: 'Lower A' },     color: '#2f7be0', price: 850000 },
    parter_b:  { name: { uz: 'Parter B',     ru: 'Партер B',     en: 'Lower B' },     color: '#2a62b8', price: 550000 },
    tribuna_a: { name: { uz: 'Tribuna A',    ru: 'Трибуна A',    en: 'Upper A' },     color: '#3b8fd6', price: 350000 },
    tribuna_b: { name: { uz: 'Tribuna B',    ru: 'Трибуна B',    en: 'Upper B' },     color: '#2c5f99', price: 200000 },
  },

  // Tadbirlar. priceMultiplier — toifa narxlarini ko'paytiradi.
  // soldRatio — demo uchun tasodifiy band qilingan joylar ulushi
  // (haqiqiy tizimda availabilityUrl orqali olinadi).
  events: [
    { id: 'hk-2026-12-05', title: { uz: 'Humo Toshkent — Ak Bars', ru: 'Хумо Ташкент — Ак Барс', en: 'Humo Tashkent vs Ak Bars' },
      date: '2026-12-05T19:00', kind: 'hockey', priceMultiplier: 1, soldRatio: 0.38 },
    { id: 'cn-2026-12-14', title: { uz: 'Yangi yil konserti', ru: 'Новогодний концерт', en: 'New Year Concert' },
      date: '2026-12-14T20:00', kind: 'concert', priceMultiplier: 1.6, soldRatio: 0.55 },
    { id: 'bx-2026-12-21', title: { uz: 'Professional boks oqshomi', ru: 'Вечер профессионального бокса', en: 'Pro Boxing Night' },
      date: '2026-12-21T18:00', kind: 'boxing', priceMultiplier: 1.3, soldRatio: 0.25 },
  ],

  // Integratsiya (ixtiyoriy):
  //  availabilityUrl: GET so'rov, javob: { "sold": ["105-3-12", ...] }. {event} o'rniga tadbir id qo'yiladi.
  //  checkoutUrl:     POST so'rov, JSON buyurtma yuboriladi; javob: { "orderId": "...", "paymentUrl": "..." }
  availabilityUrl: null, // masalan: 'https://api.sizningsayt.uz/events/{event}/sold'
  checkoutUrl: null,     // masalan: 'https://api.sizningsayt.uz/orders'
};
