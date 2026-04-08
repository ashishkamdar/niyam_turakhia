import type { Metal } from "./types";

export interface ChatScript {
  contact_name: string;
  contact_location: string;
  metal: Metal;
  purity: string;
  quantity_grams: number;
  price_per_oz: number;
  locks: boolean;
  buyer_type?: "individual" | "bank" | "crypto_exchange";
  payment_currency?: "HKD" | "USD" | "USDT";
  messages: { direction: "incoming" | "outgoing"; text: string }[];
}

export const CHAT_SCRIPTS: ChatScript[] = [
  {
    contact_name: "Mr. Chang",
    contact_location: "hong_kong",
    metal: "gold",
    purity: "24K",
    quantity_grams: 10000,
    price_per_oz: 2338.7500,
    locks: true,
    messages: [
      { direction: "incoming", text: "Good morning. I need 10 kg of 24K gold. What's your best price today?" },
      { direction: "outgoing", text: "Good morning Mr. Chang. For 10 kg 24K, I can do $2,342.50/oz." },
      { direction: "incoming", text: "That's a bit high. I'm seeing $2,335 in the market right now." },
      { direction: "outgoing", text: "Market is at $2,341.56 on the AM fix. My spread is very tight." },
      { direction: "incoming", text: "Can you come down to $2,338? For 10 kg that's a big order." },
      { direction: "outgoing", text: "For you Mr. Chang, $2,339.50 — best I can do on 10 kg." },
      { direction: "incoming", text: "Meet me at $2,338.75 and we have a deal." },
      { direction: "outgoing", text: "$2,338.75 for 10 kg 24K gold. Confirmed." },
      { direction: "incoming", text: "Yes. 10 Kg 24K Gold at USD 2338.7500 buy — lock" },
      { direction: "outgoing", text: "Locked. Deal confirmed. Will arrange delivery to HK." },
    ],
  },
  {
    contact_name: "Karim & Co.",
    contact_location: "uae",
    metal: "silver",
    purity: "999",
    quantity_grams: 50000,
    price_per_oz: 29.9850,
    locks: true,
    messages: [
      { direction: "incoming", text: "Salaam. We have 50 kg of 999 silver available. Interested?" },
      { direction: "outgoing", text: "Wa alaikum assalam. What price are you looking at?" },
      { direction: "incoming", text: "$30.25/oz for 50 kg. Good quality, certified." },
      { direction: "outgoing", text: "That's above fix. I can do $29.90/oz for the full lot." },
      { direction: "incoming", text: "Too low. $30.10 is my final." },
      { direction: "outgoing", text: "$29.985 — split the difference. 50 kg, one lot." },
      { direction: "incoming", text: "OK agreed. 50 Kg 999 Silver at USD 29.9850 sell — lock" },
      { direction: "outgoing", text: "Locked. Sending payment in AED today." },
    ],
  },
  {
    contact_name: "Shah Brothers",
    contact_location: "uae",
    metal: "platinum",
    purity: "999",
    quantity_grams: 2000,
    price_per_oz: 979.2500,
    locks: true,
    messages: [
      { direction: "incoming", text: "Need 2 kg platinum 999. Quick deal." },
      { direction: "outgoing", text: "$981.50/oz for 2 kg. Ready now." },
      { direction: "incoming", text: "$979.25 and done. 2 Kg 999 Platinum at USD 979.2500 buy — lock" },
      { direction: "outgoing", text: "Done. Locked at $979.25/oz." },
    ],
  },
  {
    contact_name: "Li Wei Trading",
    contact_location: "hong_kong",
    metal: "gold",
    purity: "24K",
    quantity_grams: 5000,
    price_per_oz: 0,
    locks: false,
    messages: [
      { direction: "incoming", text: "Hi, checking price for 5 kg 24K gold." },
      { direction: "outgoing", text: "Current offer: $2,343.00/oz for 5 kg." },
      { direction: "incoming", text: "Too expensive. I'll wait for the PM fix." },
      { direction: "outgoing", text: "PM fix might go higher. Lock now at $2,341?" },
      { direction: "incoming", text: "No thanks, I'll check back later." },
      { direction: "outgoing", text: "OK, let me know." },
    ],
  },
  {
    contact_name: "Patel Exports",
    contact_location: "uae",
    metal: "palladium",
    purity: "999",
    quantity_grams: 1000,
    price_per_oz: 1021.5000,
    locks: true,
    messages: [
      { direction: "incoming", text: "Urgent — 1 kg palladium 999. Best price?" },
      { direction: "outgoing", text: "$1,023.50/oz. Can deliver today." },
      { direction: "incoming", text: "$1,021.50 and I lock now. 1 Kg 999 Palladium at USD 1021.5000 buy — lock" },
      { direction: "outgoing", text: "Locked. Deal done." },
    ],
  },
];
