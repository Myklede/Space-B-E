// Money. The only place money changes. Reads src/core/balance.json and saves through save.js.
import balance from './balance.json';
import { emit } from './events.js';
import { save } from './save.js';

const saved = save.load().money;
let money = typeof saved === 'number' ? saved : balance.startMoney;

function set(next, reason) {
  money = next;
  save.update({ money });
  emit('economy:changed', { money, reason });
}

export const economy = {
  balance,
  getMoney: () => money,
  canAfford: (cost) => money >= cost,
  /** Pay for something (a ship). Money may go below 0, which means Bankrupt. */
  spend(cost, reason = '') {
    set(money - cost, reason);
  },
  reward(amount, reason = '') {
    set(money + amount, reason);
  },
  /** Charge the failure penalty (20% of ship cost + $250,000). No refund. Returns the penalty charged. */
  chargeFailure(shipCost) {
    const penalty = Math.round(shipCost * balance.penaltyRate + balance.penaltyBase);
    set(money - penalty, 'failure');
    return penalty;
  },
  /** Money below 0, as in the spec. */
  isBankrupt: () => money < 0,
  /** Back to the starting money. */
  reset() {
    set(balance.startMoney, 'reset');
  },
  /** Debug only: set money directly. */
  debugSet(amount) {
    set(amount, 'debug');
  },
};
