export const translateErrorMessage = (rawMsg: string | undefined | null): string => {
  if (!rawMsg) return 'Lỗi hệ thống không xác định. Vui lòng thử lại sau.';
  const msg = rawMsg.toLowerCase();
  
  // Specific Booking / Monthly Pass errors
  if (msg.includes('vehicle already has a pending reservation')) {
      return 'Biển số xe này đã có một lịch đặt chỗ đang chờ xử lý. Vui lòng thanh toán hoặc hủy lịch cũ trong Lịch sử đỗ xe.';
  }
  if (msg.includes('vehicle already has an active monthly pass')) {
      return 'Biển số xe này hiện đang có vé tháng còn hiệu lực. Không thể đăng ký thêm.';
  }
  if (msg.includes('insufficient capacity') || msg.includes('no available slots')) {
      return 'Khu vực này hiện đã hết chỗ. Vui lòng chọn khu vực khác.';
  }
  if (msg.includes('past time') || msg.includes('invalid time')) {
      return 'Thời gian không hợp lệ. Vui lòng chọn thời gian trong tương lai.';
  }
  if (msg.includes('already parked')) {
      return 'Xe này hiện đang đỗ trong bãi. Không thể thao tác lúc này.';
  }
  if (msg.includes('invalid ticket')) {
      return 'Vé không hợp lệ hoặc đã hết hạn.';
  }
  if (msg.includes('not found')) {
      return 'Không tìm thấy dữ liệu yêu cầu.';
  }

  // Fallback cleanup for "Validation failed before payment: <reason>"
  if (rawMsg.includes('Validation failed before payment:')) {
      return rawMsg.replace('Validation failed before payment:', 'Lỗi:').trim();
  }

  return rawMsg;
};
