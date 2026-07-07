import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Button, Typography } from 'antd';
import { useAuthStore } from '../../../core/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { ExclamationCircleOutlined } from '@ant-design/icons';

// --- CONFIGURATION ---
// Để test nhanh tính năng này, bạn có thể đổi thành 10 giây (10 * 1000)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // Mặc định: 30 phút

// Thời gian đếm ngược của hộp thoại cảnh báo trước khi văng (giây)
const COUNTDOWN_SECONDS = 60; // Mặc định: 60 giây
// ---------------------

export const IdleTimeoutGuard: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if current role needs idle tracking
  const requiresIdleTracking =
    isAuthenticated &&
    (role === 'ROLE_SUPER_ADMIN' || role === 'ROLE_ADMIN' || role === 'ROLE_MANAGER');

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
    setIsWarningVisible(false);
  }, [logout, navigate]);

  const resetIdleTimer = useCallback(() => {
    if (isWarningVisible) return; // Do not reset if warning is currently showing

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      setIsWarningVisible(true);
      setCountdown(COUNTDOWN_SECONDS);
    }, IDLE_TIMEOUT_MS);
  }, [isWarningVisible]);

  useEffect(() => {
    if (!requiresIdleTracking) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    // Initialize timer
    resetIdleTimer();

    // Event listeners for user activity
    const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];

    const handleActivity = () => {
      resetIdleTimer();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [requiresIdleTracking, resetIdleTimer]);

  // Handle Countdown
  useEffect(() => {
    if (isWarningVisible) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current!);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [isWarningVisible, handleLogout]);

  const handleStayLoggedIn = () => {
    setIsWarningVisible(false);
    resetIdleTimer();
  };

  return (
    <Modal
      title={
        <div className="flex items-center text-orange-500">
          <ExclamationCircleOutlined className="mr-2 text-xl" />
          <span>Session Timeout Warning</span>
        </div>
      }
      open={isWarningVisible}
      closable={false}
      maskClosable={false}
      footer={[
        <Button key="logout" danger onClick={handleLogout}>
          Logout Now
        </Button>,
        <Button key="stay" type="primary" onClick={handleStayLoggedIn}>
          I'm still here
        </Button>,
      ]}
    >
      <div className="py-4">
        <Typography.Paragraph>
          You have been inactive for a while. For your security, you will be logged out automatically in <strong>{countdown} seconds</strong>.
        </Typography.Paragraph>
        <Typography.Paragraph>
          Do you want to stay logged in?
        </Typography.Paragraph>
      </div>
    </Modal>
  );
};
