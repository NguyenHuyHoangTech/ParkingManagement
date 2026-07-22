import React from 'react';

export interface FeeBreakdownProps {
  durationMinutes: number;
  customerType: string; // 'MONTHLY', 'PREBOOKED', 'GUEST', etc.
  expectedFee?: number; // Base fee / Parking fee
  overtimeMinutes?: number;
  overtimeFee?: number;
  penaltyFee?: number;
  discountFee?: number;
  totalFee?: number; // If provided, displays as TOTAL PAYMENT. If not, will be calculated.
  isPaid?: boolean; // Useful for Reservation Fee
  isLightMode?: boolean; // Gate Console uses dark theme (text-white/slate-300), Incident Panel uses light theme (text-slate-800)
}

export const FeeBreakdown: React.FC<FeeBreakdownProps> = ({
  durationMinutes,
  customerType,
  expectedFee = 0,
  overtimeMinutes = 0,
  overtimeFee = 0,
  penaltyFee = 0,
  discountFee = 0,
  totalFee,
  isPaid = false,
  isLightMode = false,
}) => {
  const calculatedTotal = (expectedFee + overtimeFee + penaltyFee) - discountFee;
  const finalTotal = totalFee !== undefined ? totalFee : (calculatedTotal > 0 ? calculatedTotal : 0);

  // Styles based on theme mode
  const labelClass = isLightMode ? "text-sm text-slate-600" : "text-sm text-slate-300";
  const valueClass = isLightMode ? "font-bold text-slate-800 text-base" : "font-bold text-white text-base";
  const greenClass = "font-bold text-green-500 text-base";
  const redClass = "font-bold text-red-500 text-base";
  const borderClass = isLightMode ? "border-slate-200" : "border-slate-600";

  return (
    <div className="flex flex-col gap-2">
      <div className={`flex justify-between items-center ${labelClass}`}>
        <span>Parking duration:</span>
        <span className={valueClass}>{durationMinutes} minute</span>
      </div>

      {customerType === 'PREBOOKED' ? (
        <>
          {(isPaid || expectedFee > 0) && (
            <div className={`flex justify-between items-center ${labelClass}`}>
              <span>Reservation Fee (Total):</span>
              <span className={greenClass}>{isPaid ? 'Paid' : `${expectedFee.toLocaleString()} ₫`}</span>
            </div>
          )}
          {overtimeMinutes > 0 ? (
            <div className={`flex justify-between items-center ${labelClass}`}>
              <span>Overtime fee ({overtimeMinutes} minute):</span>
              <span className={redClass}>+ {overtimeFee.toLocaleString()} ₫</span>
            </div>
          ) : (
            <div className={`flex justify-between items-center ${labelClass}`}>
              <span>Additional fees:</span>
              <span className={greenClass}>Arrived on time/before time (0 VND)</span>
            </div>
          )}
        </>
      ) : customerType === 'MONTHLY' && overtimeMinutes > 0 ? (
        <>
          <div className={`flex justify-between items-center ${labelClass}`}>
            <span>Basic fee (Monthly covered):</span>
            <span className={greenClass}>Covered until expired</span>
          </div>
          <div className={`flex justify-between items-center ${labelClass}`}>
            <span>Overtime fee (from expiration - {overtimeMinutes} minute):</span>
            <span className={redClass}>+ {overtimeFee.toLocaleString()} ₫</span>
          </div>
        </>
      ) : customerType === 'MONTHLY' ? (
        <div className={`flex justify-between items-center ${labelClass}`}>
          <span>Basic fee:</span>
          <span className={greenClass}>Monthly Covered (0 VND)</span>
        </div>
      ) : (
        <div className={`flex justify-between items-center ${labelClass}`}>
          <span>Basic fee (Guest):</span>
          <span className={valueClass}>{expectedFee.toLocaleString()} ₫</span>
        </div>
      )}

      {penaltyFee > 0 && (
        <div className={`flex justify-between items-center ${labelClass}`}>
          <span>Penalty surcharge:</span>
          <span className={redClass}>+ {penaltyFee.toLocaleString()} ₫</span>
        </div>
      )}

      <div className={`flex justify-between items-center ${labelClass}`}>
        <span>Discounts/Promotions:</span>
        <span className={greenClass}>- {discountFee.toLocaleString()} ₫</span>
      </div>

      <div className={`flex justify-between items-center pt-2 mt-2 border-t ${borderClass}`}>
        <span className={`font-bold ${isLightMode ? 'text-slate-800' : 'text-slate-200'}`}>TOTAL PAYMENT:</span>
        <span className={`text-xl font-bold ${isLightMode ? 'text-green-700' : 'text-green-400'}`}>
          {finalTotal.toLocaleString()} ₫
        </span>
      </div>
    </div>
  );
};
