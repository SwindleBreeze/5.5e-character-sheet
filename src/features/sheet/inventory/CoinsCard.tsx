// Coins (plan §9.2, step 3.19): each coin's count, their worth in gold and their weight (fifty
// coins to the pound), and paying or receiving an amount. Paying uses the coin named first
// and makes change from a larger coin when it has to.

import { useState } from 'react';
import {
  COIN_CP,
  coinValueCp,
  payCoins,
  setCurrency,
  type Coin,
} from '../../../engine/play/inventory.ts';
import { COINS_PER_POUND } from '../../../engine/derive/inventory.ts';
import type { Currency } from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import type { SheetBindings } from '../sheetBindings.ts';
import { gp, lb } from './format.ts';
import styles from './inventory.module.css';

const COINS: { key: Coin; name: string }[] = [
  { key: 'cp', name: 'Copper' },
  { key: 'sp', name: 'Silver' },
  { key: 'ep', name: 'Electrum' },
  { key: 'gp', name: 'Gold' },
  { key: 'pp', name: 'Platinum' },
];

export function CoinsCard({ character, apply }: Pick<SheetBindings, 'character' | 'apply'>) {
  const purse = character.currency;
  const [amount, setAmount] = useState('');
  const [coin, setCoin] = useState<Coin>('gp');
  const [error, setError] = useState('');
  const count = COINS.reduce((n, c) => n + purse[c.key], 0);
  const parsed = Number(amount.replace(',', '.'));
  const valid = amount.trim() !== '' && Number.isFinite(parsed) && parsed > 0;
  const cp = valid ? Math.round(parsed * COIN_CP[coin]) : 0;

  const setCoinCount = (key: Coin, n: number) =>
    apply((c) => setCurrency(c, { ...c.currency, [key]: n } as Currency));

  return (
    <div className={styles.card}>
      <div className={styles.coins}>
        {COINS.map((c) => (
          <label key={c.key} className={styles.coin}>
            <abbr className={styles.coinCode} title={`${c.name} pieces`}>
              {c.key.toUpperCase()}
            </abbr>
            <input
              key={purse[c.key]}
              aria-label={`${c.name} pieces`}
              inputMode="numeric"
              defaultValue={purse[c.key]}
              onFocus={(e) => e.target.select()}
              onBlur={(e) => {
                const n = Math.floor(Number(e.target.value));
                if (Number.isFinite(n) && n !== purse[c.key]) setCoinCount(c.key, n);
                else e.target.value = String(purse[c.key]);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          </label>
        ))}
      </div>
      <p className={styles.muted}>
        Worth {gp(coinValueCp(purse))} · {count} coins, {lb(count / COINS_PER_POUND)} lb.
      </p>
      <form
        className={styles.pay}
        aria-label="Pay or receive coins"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          aria-label="Coin amount"
          inputMode="decimal"
          placeholder="Amount"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError('');
          }}
        />
        <select aria-label="Coin" value={coin} onChange={(e) => setCoin(e.target.value as Coin)}>
          {COINS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.key.toUpperCase()}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          aria-disabled={!valid}
          onClick={() => {
            if (!valid) return;
            const next = payCoins(purse, cp, coin);
            if (!next) {
              setError(`That’s ${gp(cp)}; you have ${gp(coinValueCp(purse))}.`);
              return;
            }
            apply((c) => setCurrency(c, next));
            setAmount('');
          }}
        >
          Pay
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-disabled={!valid || !Number.isInteger(parsed)}
          onClick={() => {
            if (!valid || !Number.isInteger(parsed)) return;
            apply((c) => setCurrency(c, { ...c.currency, [coin]: c.currency[coin] + parsed }));
            setAmount('');
          }}
        >
          Receive
        </Button>
      </form>
      {error && (
        <p className={styles.warn} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
