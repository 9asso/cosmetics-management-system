import type { CheckDetails } from "@cosmetics/contracts";
import { ui } from "../lib/ui";
export const emptyCheck: CheckDetails = {
  bankName: "",
  checkNumber: "",
  dueDate: "",
};
export function CheckFields({
  value,
  onChange,
}: {
  value: CheckDetails;
  onChange: (value: CheckDetails) => void;
}) {
  return (
    <div className={ui("form-grid")}>
      <label>
        <span>Banque</span>
        <input
          required
          minLength={2}
          maxLength={120}
          value={value.bankName}
          onChange={(e) => onChange({ ...value, bankName: e.target.value })}
        />
      </label>
      <label>
        <span>Numéro du chèque</span>
        <input
          required
          maxLength={100}
          value={value.checkNumber}
          onChange={(e) => onChange({ ...value, checkNumber: e.target.value })}
        />
      </label>
      <label>
        <span>Échéance du chèque</span>
        <input
          required
          type="date"
          value={value.dueDate}
          onChange={(e) => onChange({ ...value, dueDate: e.target.value })}
        />
      </label>
      <p className="self-center text-xs text-muted">
        Le solde sera réduit après confirmation du règlement bancaire dans
        Finances &amp; dépenses.
      </p>
    </div>
  );
}
