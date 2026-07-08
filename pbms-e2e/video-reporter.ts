import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

export default class VideoReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    // Tìm attachment video của bài test
    const videoAttachment = result.attachments.find(a => a.name === 'video');
    
    if (videoAttachment && videoAttachment.path && fs.existsSync(videoAttachment.path)) {
      // Thư mục đích để lưu video có cấu trúc
      // Chỉ thay thế các ký tự không hợp lệ cho đường dẫn (Windows/Linux) bằng dấu gạch dưới
      const sanitizeName = (name: string) => name.replace(/[<>:"\/\\|?*]+/g, '_');
      
      const outputDir = path.join(process.cwd(), 'test-videos', sanitizeName(test.parent.title));
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Tạo tên file giữ nguyên tiếng Việt, chỉ bỏ các ký tự cấm của hệ điều hành
      const safeTitle = sanitizeName(test.title);
      const newVideoPath = path.join(outputDir, `${safeTitle}.webm`);
      
      // Copy video ra thư mục mới với tên đẹp
      fs.copyFileSync(videoAttachment.path, newVideoPath);
      console.log(`\n🎬 Đã lưu video test: ${newVideoPath}`);
    }
  }
}
