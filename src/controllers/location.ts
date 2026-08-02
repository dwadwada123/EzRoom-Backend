import { Request, Response } from 'express';

// Helper: Format raw Nominatim display_name into a clean, concise Vietnamese address
function formatVietnameseAddress(displayName: string, userHouseNum?: string): string {
  if (!displayName) return '';
  
  // Split by comma
  const parts = displayName.split(',').map(p => p.trim());
  
  // Filter out zip codes (e.g., 550000, 700000) and country names ("Việt Nam", "Vietnam")
  const filtered = parts.filter(p => {
    const isZip = /^\d{5,6}$/.test(p);
    const isCountry = p.toLowerCase() === 'việt nam' || p.toLowerCase() === 'vietnam';
    return !isZip && !isCountry;
  });

  // Shorten administrative prefixes for better readability on mobile screens
  const cleaned = filtered.map(p => {
    return p
      .replace(/^Thành phố\s+/i, '')
      .replace(/^Tỉnh\s+/i, '')
      .replace(/^Quận\s+/i, 'Q. ')
      .replace(/^Huyện\s+/i, 'H. ')
      .replace(/^Phường\s+/i, 'P. ')
      .replace(/^Xã\s+/i, 'X. ')
      .replace(/^Thị trấn\s+/i, 'Tt. ');
  });

  let result = cleaned.join(', ');

  // If user typed a house number (e.g. "12") and the result doesn't start with a number, prepend it!
  if (userHouseNum && /^\d+[\/\d\w]*$/.test(userHouseNum)) {
    if (!/^\d+/.test(result)) {
      result = `${userHouseNum} ${result}`;
    }
  }

  return result;
}

async function fetchNominatim(queryStr: string): Promise<any[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=json&limit=8&addressdetails=1&accept-language=vi`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'EzRoom-App/1.0 (contact@ezroom.com)'
    }
  });

  if (!response.ok) {
    return [];
  }

  return (await response.json()) as any[];
}

// Controller: Handle Nominatim Geocoding and Autocomplete Suggestions
export async function suggestLocation(req: Request, res: Response) {
  try {
    const q = (req.query.q as string || '').trim();
    const rawProvince = (req.query.province as string || '').trim();
    const rawWard = (req.query.ward as string || '').trim();

    if (!q) {
      return res.status(200).json([]);
    }

    // Clean administrative prefixes to prevent Nominatim string mismatch
    // e.g., "Thành phố Đà Nẵng" -> "Đà Nẵng", "Quận Liên Chiểu" -> "Liên Chiểu"
    const cleanProvince = rawProvince.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim();
    const cleanWard = rawWard.replace(/^(Phường|Xã|Thị trấn|Quận|Huyện)\s+/i, '').trim();

    // Extract leading house number if present (e.g., "12 hoà nam 6" -> houseNum="12", street="hoà nam 6")
    const houseNumMatch = q.match(/^(\d+[\/\d\w]*)\s+(.+)$/);
    const userHouseNum = houseNumMatch ? houseNumMatch[1] : undefined;
    const streetPart = houseNumMatch ? houseNumMatch[2] : q;

    // Scope query string with clean ward and province
    let scopeQuery = '';
    if (cleanWard) scopeQuery += `, ${cleanWard}`;
    if (cleanProvince) scopeQuery += `, ${cleanProvince}`;
    scopeQuery += `, Vietnam`;

    // Tier 1: Search exact query + ward + province
    let data = await fetchNominatim(`${q}${scopeQuery}`);

    // Tier 2: If 0 results and house number was typed, search streetPart + ward + province
    if (data.length === 0 && houseNumMatch) {
      data = await fetchNominatim(`${streetPart}${scopeQuery}`);
    }

    // Tier 3: If 0 results and ward was set, drop ward BUT STRICTLY KEEP PROVINCE
    if (data.length === 0 && cleanProvince) {
      const provinceScope = `, ${cleanProvince}, Vietnam`;
      data = await fetchNominatim(`${q}${provinceScope}`);
      if (data.length === 0 && houseNumMatch) {
        data = await fetchNominatim(`${streetPart}${provinceScope}`);
      }
    }

    // Tier 4: If STILL 0 results and no province was selected at all, search nationwide
    if (data.length === 0 && !cleanProvince) {
      data = await fetchNominatim(`${streetPart}, Vietnam`);
    }

    // STRICT LOCATION GUARD: Ensure returned suggestions match the selected province if selected!
    let filteredData = data;
    if (cleanProvince) {
      const provLower = cleanProvince.toLowerCase();
      filteredData = data.filter(item => {
        const nameLower = item.display_name.toLowerCase();
        return nameLower.includes(provLower);
      });
      // Fallback to original data if strict matching was overly restrictive
      if (filteredData.length === 0) {
        filteredData = data;
      }
    }

    // Sanitize & format suggestions cleanly
    const suggestions = filteredData.map(item => ({
      displayName: formatVietnameseAddress(item.display_name, userHouseNum),
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon)
    }));

    return res.status(200).json(suggestions);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

export async function geocodeLocation(req: Request, res: Response) {
  try {
    const q = (req.query.q as string || '').trim();

    if (!q) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required' });
    }

    const data = await fetchNominatim(`${q}, Vietnam`);
    if (data.length === 0) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    return res.status(200).json({
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon)
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
