const CABUYAO_WATER_RATE_TABLE = {
  residential: {
    label: 'Residential',
    first_0_10_package: 190.0,
    next_11_20: 21.0,
    next_21_30: 22.6,
    next_31_40: 24.7,
    over_40: 27.0
  },
  commercial_2_0: {
    label: 'Commercial (2.0)',
    first_0_10_package: 380.0,
    next_11_20: 42.0,
    next_21_30: 45.2,
    next_31_40: 49.4,
    over_40: 54.0
  },
  commercial_a_1_75: {
    label: 'Commercial - A (1.75)',
    first_0_10_package: 332.5,
    next_11_20: 36.75,
    next_21_30: 39.55,
    next_31_40: 43.23,
    over_40: 47.25
  },
  commercial_b_1_50: {
    label: 'Commercial - B (1.50)',
    first_0_10_package: 285.0,
    next_11_20: 31.5,
    next_21_30: 33.9,
    next_31_40: 37.05,
    over_40: 40.5
  },
  commercial_c_1_25: {
    label: 'Commercial - C (1.25)',
    first_0_10_package: 237.5,
    next_11_20: 26.25,
    next_21_30: 28.25,
    next_31_40: 30.88,
    over_40: 33.75
  },
  hvha_hongkong_village: {
    label: 'HVHA Water System (Hongkong Village)',
    flat_per_cum: 10.0
  }
};

const CATEGORY_ALIASES = {
  residential: 'residential',
  home: 'residential',
  commercial: 'commercial_2_0',
  commercial_2_0: 'commercial_2_0',
  commercial2: 'commercial_2_0',
  commercial_a: 'commercial_a_1_75',
  commercial_a_1_75: 'commercial_a_1_75',
  commercial_b: 'commercial_b_1_50',
  commercial_b_1_50: 'commercial_b_1_50',
  commercial_c: 'commercial_c_1_25',
  commercial_c_1_25: 'commercial_c_1_25',
  hvha: 'hvha_hongkong_village',
  hongkong_village: 'hvha_hongkong_village',
  hongkong_village_cabuyao: 'hvha_hongkong_village',
  hvha_hongkong_village: 'hvha_hongkong_village',
  hvha_water_system: 'hvha_hongkong_village'
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeWaterRateCategory = (value) => {
  const key = String(value || 'residential').trim().toLowerCase().replace(/[\s\-]+/g, '_');
  return CATEGORY_ALIASES[key] || 'residential';
};

const toFixedNumber = (value, decimals = 2) => Number(toNumber(value).toFixed(decimals));

function calculateCabuyaoWaterBill(usage, category = 'residential') {
  const usageValue = Math.max(0, toNumber(usage, 0));
  const normalizedCategory = normalizeWaterRateCategory(category);
  const rates = CABUYAO_WATER_RATE_TABLE[normalizedCategory] || CABUYAO_WATER_RATE_TABLE.residential;

  if (usageValue <= 0) {
    return {
      usage: 0,
      category: normalizedCategory,
      category_label: rates.label,
      estimated_cost: 0,
      effective_rate: 0,
      breakdown: {
        first_0_10_package: 0,
        usage_11_20: 0,
        usage_21_30: 0,
        usage_31_40: 0,
        usage_over_40: 0
      }
    };
  }

  // HVHA billing from provided sample bill: 23 Cu.M => 230 PHP (flat 10 PHP/Cu.M).
  if (normalizedCategory === 'hvha_hongkong_village') {
    const totalCost = usageValue * rates.flat_per_cum;
    return {
      usage: toFixedNumber(usageValue, 4),
      category: normalizedCategory,
      category_label: rates.label,
      estimated_cost: toFixedNumber(totalCost, 2),
      effective_rate: toFixedNumber(rates.flat_per_cum, 4),
      breakdown: {
        flat_per_cum: toFixedNumber(totalCost, 2)
      }
    };
  }

  let remaining = usageValue;
  let totalCost = 0;

  // The first block is a fixed package charge for up to the first 10 cubic meters.
  const firstBlockUsage = Math.min(remaining, 10);
  if (firstBlockUsage > 0) {
    totalCost += rates.first_0_10_package;
    remaining -= firstBlockUsage;
  }

  const usage11To20 = Math.min(Math.max(remaining, 0), 10);
  totalCost += usage11To20 * rates.next_11_20;
  remaining -= usage11To20;

  const usage21To30 = Math.min(Math.max(remaining, 0), 10);
  totalCost += usage21To30 * rates.next_21_30;
  remaining -= usage21To30;

  const usage31To40 = Math.min(Math.max(remaining, 0), 10);
  totalCost += usage31To40 * rates.next_31_40;
  remaining -= usage31To40;

  const usageOver40 = Math.max(remaining, 0);
  totalCost += usageOver40 * rates.over_40;

  const effectiveRate = usageValue > 0 ? totalCost / usageValue : 0;

  return {
    usage: toFixedNumber(usageValue, 4),
    category: normalizedCategory,
    category_label: rates.label,
    estimated_cost: toFixedNumber(totalCost, 2),
    effective_rate: toFixedNumber(effectiveRate, 4),
    breakdown: {
      first_0_10_package: toFixedNumber(firstBlockUsage > 0 ? rates.first_0_10_package : 0, 2),
      usage_11_20: toFixedNumber(usage11To20 * rates.next_11_20, 2),
      usage_21_30: toFixedNumber(usage21To30 * rates.next_21_30, 2),
      usage_31_40: toFixedNumber(usage31To40 * rates.next_31_40, 2),
      usage_over_40: toFixedNumber(usageOver40 * rates.over_40, 2)
    }
  };
}

module.exports = {
  CABUYAO_WATER_RATE_TABLE,
  normalizeWaterRateCategory,
  calculateCabuyaoWaterBill
};
