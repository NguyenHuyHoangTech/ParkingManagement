import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Tabs, message, Typography, Divider, Alert } from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  GoogleOutlined, 
  SafetyCertificateOutlined,
  SaveOutlined,
  BugOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../../../core/store/useAuthStore';
import { useMutation } from '@tanstack/react-query';
import axiosClient from '../../../core/api/axiosClient';
import { GoogleLogin } from '@react-oauth/google';
import { GlobalReservationDebugWidget } from '../../debug/GlobalReservationDebugWidget';

const { Title, Text } = Typography;

interface UserProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileSettingsModal: React.FC<UserProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();
  
  const email = useAuthStore(state => state.email);
  const name = useAuthStore(state => state.name);
  const authProvider = useAuthStore(state => state.authProvider);
  const hasPassword = useAuthStore(state => state.hasPassword);
  
  const updateProfile = useAuthStore(state => state.updateProfile);
  const linkGoogleAccount = useAuthStore(state => state.linkGoogleAccount);
  const createPassword = useAuthStore(state => state.createPassword);

  const [activeTab, setActiveTab] = useState('1');

  useEffect(() => {
    if (isOpen) {
      form.setFieldsValue({
        name: name || '',
        email: email || ''
      });
      pwdForm.resetFields();
      setActiveTab('1');
    }
  }, [isOpen, name, email, form, pwdForm]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: any) => {
      const response = await axiosClient.put('/identity/auth/profile', { name: values.name });
      return response.data;
    },
    onSuccess: (_, variables) => {
      updateProfile(variables.name);
      message.success({ content: 'Update successful!', key: 'profile', duration: 2 });
    },
    onError: (error: any) => {
      message.error({ content: error.response?.data?.message || 'Error when updating profile', key: 'profile', duration: 3 });
    }
  });

  const handleUpdateProfile = (values: any) => {
    message.loading({ content: 'Saving...', key: 'profile' });
    updateProfileMutation.mutate(values);
  };

  const linkGoogleMutation = useMutation({
    mutationFn: async (credential: string) => {
      const response = await axiosClient.post('/identity/auth/link-google', { googleIdToken: credential });
      return response.data;
    },
    onSuccess: () => {
      message.success({ content: 'Google account linked successfully!', key: 'google', duration: 2 });
      linkGoogleAccount(); // Updates local Zustand store (authProvider='GOOGLE')
    },
    onError: (error: any) => {
      message.error({ content: error.response?.data?.message || 'Error when linking Google account', key: 'google', duration: 3 });
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (values: any) => {
      if (hasPassword) {
        const response = await axiosClient.post('/identity/auth/change-password', {
          oldPassword: values.oldPassword,
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword
        });
        return response.data;
      } else {
        const response = await axiosClient.post('/identity/auth/set-password', {
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword
        });
        return response.data;
      }
    },
    onSuccess: () => {
      if (!hasPassword) {
        createPassword(); // Update local Zustand state
        message.success({ content: 'Password created successfully!', key: 'pwd', duration: 2 });
      } else {
        message.success({ content: 'Password changed successfully!', key: 'pwd', duration: 2 });
      }
      pwdForm.resetFields();
    },
    onError: (error: any) => {
      message.error({ content: error.response?.data?.message || 'Error when changing Password', key: 'pwd', duration: 3 });
    }
  });

  const handleChangePassword = (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      return message.error('Passwords do not match!');
    }
    message.loading({ content: 'Processing...', key: 'pwd' });
    changePasswordMutation.mutate(values);
  };

  return (
    <Modal
      title={<span className="text-xl font-bold">Account Settings</span>}
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={500}
      destroyOnClose
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} className="mt-4">
        
        {/* TAB 1: PERSONAL INFO */}
        <Tabs.TabPane tab={<span><UserOutlined />Profile</span>} key="1">
          <Form form={form} layout="vertical" onFinish={handleUpdateProfile} className="mt-2">
            <Form.Item label="Login Email">
              <Input disabled value={email || ''} className="bg-gray-50 text-gray-500" />
            </Form.Item>
            <Form.Item 
              name="name" 
              label="Display Name" 
              rules={[{ required: true, message: 'Please enter a display name!' }]}
            >
              <Input placeholder="Enter your name" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large" className="w-full mt-2">
              Save Changes
            </Button>
          </Form>
        </Tabs.TabPane>

        {/* TAB 2: SECURITY */}
        <Tabs.TabPane tab={<span><SafetyCertificateOutlined />Security & Linking</span>} key="2">
          <div className="mt-2 space-y-6">
            
            {/* Account Information */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <Text strong className="text-gray-700">Google Link Status:</Text>
                {authProvider === 'GOOGLE' ? (
                  <span className="text-green-600 font-bold text-sm bg-green-100 px-2 py-1 rounded">Linked</span>
                ) : (
                  <span className="text-gray-500 text-sm">Not linked yet</span>
                )}
              </div>
              
              {authProvider !== 'GOOGLE' ? (
                <>
                  <Text className="text-xs text-gray-500 block mb-3">To link your Google account, simply log out and use the "Login with Google" button with the email: {email}</Text>
                </>
              ) : (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <GoogleOutlined className="text-red-500" />
                  <Text>This account is logged in via Google</Text>
                </div>
              )}
            </div>

            <Divider className="my-0" />

            {/* Management Password */}
            <div>
              <Title level={5} className="mb-4">
                <LockOutlined className="mr-2 text-blue-500" />
                {hasPassword ? 'Change Password' : 'Create Login Password'}
              </Title>
              
              {!hasPassword && (
                <Alert 
                  type="info" 
                  showIcon 
                  className="mb-4"
                  message="You don't have a password yet"
                  description="You logged in with Google. Please create a password so you can log in directly using your email without relying on Google."
                />
              )}

              <Form form={pwdForm} layout="vertical" onFinish={handleChangePassword}>
                {hasPassword && (
                  <Form.Item 
                    name="oldPassword" 
                    label="Current Password"
                    rules={[{ required: true, message: 'Please enter your current password' }]}
                  >
                    <Input.Password placeholder="Enter current password" />
                  </Form.Item>
                )}
                
                <Form.Item 
                  name="newPassword" 
                  label="New Password"
                  rules={[
                    { required: true, message: 'Please enter a new password' },
                    { 
                      pattern: /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!_]).{8,20}$/,
                      message: 'Password must be 8-20 characters long, including uppercase, lowercase, numbers, and special characters.'
                    }
                  ]}
                >
                  <Input.Password placeholder="Enter new password" />
                </Form.Item>
                
                <Form.Item 
                  name="confirmPassword" 
                  label="Confirm Password"
                  rules={[{ required: true, message: 'Please confirm your new password' }]}
                >
                  <Input.Password placeholder="Re-enter new password" />
                </Form.Item>

                <Button type="primary" htmlType="submit" className="w-full">
                  {hasPassword ? 'Change Password' : 'Create Password'}
                </Button>
              </Form>
            </div>
          </div>
        </Tabs.TabPane>
        {/* TAB 3: DEVELOPER / DEBUG */}
        <Tabs.TabPane tab={<span><BugOutlined />Debug</span>} key="3">
          <div className="mt-2 flex flex-col items-center justify-center space-y-4 py-8 bg-slate-50 border border-slate-200 rounded-lg">
            <Title level={5} className="text-slate-700 text-center m-0">Reservation Timers & IoT Debugging</Title>
            <Text className="text-slate-500 text-center block max-w-xs mb-4">
              Open the debug console to fast-forward time or trigger IoT events.
            </Text>
            <GlobalReservationDebugWidget />
          </div>
        </Tabs.TabPane>
      </Tabs>
    </Modal>
  );
};
