"use client";

import { useEffect, useState } from "react";

export function useClawdPrice() {
  const [price, setPrice] = useState<number>(0);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(
          "https://api.dexscreener.com/latest/dex/tokens/0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07",
        );
        const data = await res.json();
        if (data.pairs?.[0]?.priceUsd) {
          setPrice(parseFloat(data.pairs[0].priceUsd));
        }
      } catch {
        // silently fail
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000);
    return () => clearInterval(interval);
  }, []);

  return price;
}
