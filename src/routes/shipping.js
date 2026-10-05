const express = require('express');
const router = express.Router();

// Daftar kota-kota besar di Indonesia beserta pulau untuk perhitungan zonasi tarif
const cities = [
  { id: "1", name: "Jakarta", province: "DKI Jakarta", island: "Jawa" },
  { id: "2", name: "Bandung", province: "Jawa Barat", island: "Jawa" },
  { id: "3", name: "Bekasi", province: "Jawa Barat", island: "Jawa" },
  { id: "4", name: "Bogor", province: "Jawa Barat", island: "Jawa" },
  { id: "5", name: "Depok", province: "Jawa Barat", island: "Jawa" },
  { id: "6", name: "Semarang", province: "Jawa Tengah", island: "Jawa" },
  { id: "7", name: "Surakarta", province: "Jawa Tengah", island: "Jawa" },
  { id: "8", name: "Surabaya", province: "Jawa Timur", island: "Jawa" },
  { id: "9", name: "Malang", province: "Jawa Timur", island: "Jawa" },
  { id: "10", name: "Yogyakarta", province: "DI Yogyakarta", island: "Jawa" },
  { id: "11", name: "Tangerang", province: "Banten", island: "Jawa" },
  { id: "12", name: "Serang", province: "Banten", island: "Jawa" },
  { id: "13", name: "Denpasar", province: "Bali", island: "Bali" },
  { id: "14", name: "Medan", province: "Sumatra Utara", island: "Sumatra" },
  { id: "15", name: "Padang", province: "Sumatra Barat", island: "Sumatra" },
  { id: "16", name: "Pekanbaru", province: "Riau", island: "Sumatra" },
  { id: "17", name: "Batam", province: "Kepulauan Riau", island: "Sumatra" },
  { id: "18", name: "Palembang", province: "Sumatra Selatan", island: "Sumatra" },
  { id: "19", name: "Bandar Lampung", province: "Lampung", island: "Sumatra" },
  { id: "20", name: "Pontianak", province: "Kalimantan Barat", island: "Kalimantan" },
  { id: "21", name: "Samarinda", province: "Kalimantan Timur", island: "Kalimantan" },
  { id: "22", name: "Balikpapan", province: "Kalimantan Timur", island: "Kalimantan" },
  { id: "23", name: "Makassar", province: "Sulawesi Selatan", island: "Sulawesi" },
  { id: "24", name: "Manado", province: "Sulawesi Utara", island: "Sulawesi" },
  { id: "25", name: "Ambon", province: "Maluku", island: "MalukuPapua" },
  { id: "26", name: "Jayapura", province: "Papua", island: "MalukuPapua" }
];

// Endpoint untuk mendapatkan daftar kota
router.get('/cities', (req, res) => {
  res.json(cities);
});

// Endpoint untuk menghitung biaya pengiriman
router.post('/estimate', (req, res) => {
  let { originCity, destCityId, weight } = req.body;
  
  if (!originCity || !destCityId) {
    return res.status(400).json({ error: "Origin city and Destination city ID are required." });
  }

  // Berat default minimal 1000 gram (1kg) jika tidak diisi atau 0
  weight = parseInt(weight) || 1000;
  if (weight < 1) weight = 1000;
  
  // Konversi berat ke KG (bulatkan ke atas seperti standar ekspedisi)
  const weightKg = Math.ceil(weight / 1000);

  // Cari kota asal dan kota tujuan
  const origin = cities.find(c => c.name.toLowerCase() === originCity.toLowerCase()) || { name: originCity, island: "Jawa" };
  const dest = cities.find(c => c.id === destCityId);

  if (!dest) {
    return res.status(404).json({ error: "Destination city not found." });
  }

  // Hitung tarif dasar per KG berdasarkan wilayah
  let baseRateReg = 12000; // Standar REG per kg
  let baseRateFast = 22000; // Standar YES/Fast per kg

  if (origin.name.toLowerCase() === dest.name.toLowerCase()) {
    // Satu kota
    baseRateReg = 8000;
    baseRateFast = 15000;
  } else if (origin.island === dest.island) {
    // Satu pulau
    baseRateReg = 12000;
    baseRateFast = 22000;
  } else {
    // Antar pulau
    const key = `${origin.island}-${dest.island}`;
    const reverseKey = `${dest.island}-${origin.island}`;
    
    if (key === 'Jawa-Sumatra' || reverseKey === 'Jawa-Sumatra') {
      baseRateReg = 20000;
      baseRateFast = 35000;
    } else if (key === 'Jawa-Bali' || reverseKey === 'Jawa-Bali') {
      baseRateReg = 16000;
      baseRateFast = 28000;
    } else if (key === 'Jawa-Kalimantan' || reverseKey === 'Jawa-Kalimantan') {
      baseRateReg = 25000;
      baseRateFast = 45000;
    } else if (key === 'Jawa-Sulawesi' || reverseKey === 'Jawa-Sulawesi') {
      baseRateReg = 29000;
      baseRateFast = 52000;
    } else if (key === 'Jawa-MalukuPapua' || reverseKey === 'Jawa-MalukuPapua') {
      baseRateReg = 42000;
      baseRateFast = 70000;
    } else {
      // Default antar pulau lainnya
      baseRateReg = 32000;
      baseRateFast = 58000;
    }
  }

  // Kurir 1: J&T Express
  const jnt = {
    name: "J&T Express",
    services: [
      { service: "EZ (Regular)", cost: baseRateReg * weightKg, etd: origin.island === dest.island ? "2-3 Hari" : "3-5 Hari" },
      { service: "J&T Super (Cepat)", cost: baseRateFast * weightKg, etd: "1-2 Hari" }
    ]
  };

  // Kurir 2: SiCepat
  const sicepat = {
    name: "SiCepat",
    services: [
      { service: "REG (Regular)", cost: (baseRateReg - 1000) * weightKg, etd: origin.island === dest.island ? "2-3 Hari" : "3-5 Hari" },
      { service: "BEST (Besok Sampai)", cost: (baseRateFast - 2000) * weightKg, etd: "1 Hari" }
    ]
  };

  // Kurir 3: Anteraja
  const anteraja = {
    name: "Anteraja",
    services: [
      { service: "Regular", cost: (baseRateReg - 500) * weightKg, etd: origin.island === dest.island ? "2-3 Hari" : "3-5 Hari" },
      { service: "Economy (Hemat)", cost: Math.max(7000, baseRateReg - 4000) * weightKg, etd: "4-7 Hari" }
    ]
  };

  // Kurir 4: JNE
  const jne = {
    name: "JNE",
    services: [
      { service: "REG (Regular)", cost: baseRateReg * weightKg, etd: origin.island === dest.island ? "2-3 Hari" : "3-5 Hari" },
      { service: "YES (Yakin Esok Sampai)", cost: baseRateFast * weightKg, etd: "1 Hari" }
    ]
  };

  // Kurir 5: Pos Indonesia
  const pos = {
    name: "Pos Indonesia",
    services: [
      { service: "Pos Sameday", cost: (baseRateFast + 5000) * weightKg, etd: "1 Hari" },
      { service: "Pos Kilat Khusus", cost: (baseRateReg - 2000) * weightKg, etd: origin.island === dest.island ? "2-4 Hari" : "3-6 Hari" }
    ]
  };

  res.json({
    origin: origin.name,
    weight: weight,
    weightKg: weightKg,
    results: [jnt, sicepat, anteraja, jne, pos]
  });
});

module.exports = router;
