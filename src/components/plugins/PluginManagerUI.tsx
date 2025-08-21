import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Space, Tag, Switch, Modal, message, Popconfirm } from 'antd';
import { PlusOutlined, ImportOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { PluginManager } from '../../plugins/core/PluginSystem';
import { PluginImportModal } from './PluginImportModal';
import { ImportResult } from '../../plugins/import/ZipPluginImporter';

interface PluginManagerUIProps {
  pluginManager: PluginManager;
}

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  enabled: boolean;
  path: string;
  dependencies: string[];
  lastUpdated: Date;
}

export const PluginManagerUI: React.FC<PluginManagerUIProps> = ({ pluginManager }) => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const registeredPlugins = pluginManager.list();
      const pluginInfos: PluginInfo[] = registeredPlugins.map(plugin => ({
        id: plugin.metadata.id,
        name: plugin.metadata.name,
        version: plugin.metadata.version,
        description: plugin.metadata.description,
        author: plugin.metadata.author,
        category: plugin.metadata.category || 'general',
        enabled: pluginManager.isEnabled(plugin.metadata.id),
        path: plugin.metadata.main,
        dependencies: Object.keys(plugin.metadata.dependencies || {}),
        lastUpdated: new Date() // This would come from filesystem metadata
      }));
      
      setPlugins(pluginInfos);
    } catch (error) {
      console.error('Failed to load plugins:', error);
      message.error('Failed to load plugins');
    } finally {
      setLoading(false);
    }
  }, [pluginManager]);

  const handleEnableDisable = useCallback(async (pluginId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await pluginManager.enable(pluginId);
        message.success(`Plugin "${pluginId}" enabled`);
      } else {
        await pluginManager.disable(pluginId);
        message.success(`Plugin "${pluginId}" disabled`);
      }
      
      await loadPlugins();
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
      message.error('Failed to toggle plugin');
    }
  }, [pluginManager, loadPlugins]);

  const handleImportSuccess = useCallback(async (result: ImportResult) => {
    setImportModalVisible(false);
    await loadPlugins();
    
    if (result.success) {
      message.success(`Plugin "${result.plugin.name}" imported successfully`);
    }
  }, [loadPlugins]);

  const handleRefresh = useCallback(async () => {
    await loadPlugins();
    message.success('Plugins refreshed');
  }, [loadPlugins]);

  const handleDelete = useCallback(async (pluginId: string) => {
    try {
      // This would need to be implemented in PluginManager
      // For now, we'll just disable it
      await pluginManager.disable(pluginId);
      message.success(`Plugin "${pluginId}" removed`);
      await loadPlugins();
    } catch (error) {
      console.error('Failed to remove plugin:', error);
      message.error('Failed to remove plugin');
    }
  }, [pluginManager, loadPlugins]);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: PluginInfo) => (
        <Space direction="vertical" size={0}>
          <strong>{text}</strong>
          <Text type="secondary">{record.id}</Text>
        </Space>
      )
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      render: (version: string) => <Tag color="blue">{version}</Tag>
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <Tag color="green">{category}</Tag>
    },
    {
      title: 'Author',
      dataIndex: 'author',
      key: 'author'
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record: PluginInfo) => (
        <Switch
          checked={record.enabled}
          onChange={(checked) => handleEnableDisable(record.id, checked)}
          loading={loading}
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: PluginInfo) => (
        <Space>
          <Popconfirm
            title="Are you sure you want to remove this plugin?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Plugin Manager"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<ImportOutlined />}
              onClick={() => setImportModalVisible(true)}
            >
              Import Plugin
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={plugins}
          loading={loading}
          rowKey="id"
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Total ${total} plugins`
          }}
        />
      </Card>

      <PluginImportModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};