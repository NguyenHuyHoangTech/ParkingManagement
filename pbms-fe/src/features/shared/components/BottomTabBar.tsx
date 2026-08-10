import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HomeOutlined, CarOutlined, HistoryOutlined, SettingOutlined } from '@ant-design/icons';

interface BottomTabBarProps {
  onOpenSettings: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ onOpenSettings }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { key: '/customer/home', icon: <HomeOutlined className="text-xl mb-1" />, label: 'Home' },
    { key: '/customer/pre-booking', icon: <CarOutlined className="text-xl mb-1" />, label: 'Booking' },
    { key: '/customer/my-parking', icon: <HistoryOutlined className="text-xl mb-1" />, label: 'My Parking' },
    { key: 'settings', icon: <SettingOutlined className="text-xl mb-1" />, label: 'Settings', isAction: true },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-[100] pb-safe h-16 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-full max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = !item.isAction && location.pathname.startsWith(item.key);
          
          return (
            <div
              key={item.key}
              className={`flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition-all duration-300 ${isActive ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              onClick={() => {
                if (item.isAction && item.key === 'settings') {
                  onOpenSettings();
                } else if (!item.isAction) {
                  navigate(item.key);
                }
              }}
            >
              {item.icon}
              <span className={`text-[10px] font-bold ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
