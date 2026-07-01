const express = require('express');
const { connectDb } = require('./db');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

function mapProvince(prov) {
  return {
    code: prov.Code,
    name: prov.Name,
    fullName: prov.FullName,
    codeName: prov.CodeName,
    type: prov.Type,
    administrativeUnitId: prov.AdministrativeUnitId,
    wards: (prov.Wards || []).map(ward => ({
      code: ward.Code,
      name: ward.Name,
      fullName: ward.FullName,
      codeName: ward.CodeName,
      type: ward.Type,
      administrativeUnitId: ward.AdministrativeUnitId
    }))
  };
}

app.get('/api/provinces', async (req, res) => {
  try {
    const db = await connectDb();
    const rawProvinces = await db.collection('provinces').find({}).toArray();
    const mapped = rawProvinces.map(mapProvince);
    res.status(200).json(mapped);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ success: false, error: 'Database connection failed.' });
  }
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = app;


