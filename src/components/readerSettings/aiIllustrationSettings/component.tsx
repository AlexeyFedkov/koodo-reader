import React from "react";
import { AIIllustrationSettingsProps, AIIllustrationSettingsState } from "./interface";
import { Trans } from "react-i18next";
import { AIIllustrationConfigService } from "../../../services/utils/config";
import { aiIllustrationService } from "../../../services/aiIllustrationService";
import { aiApiService } from "../../../services/aiApiService";
import toast from "react-hot-toast";
import "./aiIllustrationSettings.css";

class AIIllustrationSettings extends React.Component<
  AIIllustrationSettingsProps,
  AIIllustrationSettingsState
> {
  constructor(props: AIIllustrationSettingsProps) {
    super(props);
    
    const config = AIIllustrationConfigService.getConfig();
    this.state = {
      isEnabled: config.enabled,
      frequency: config.frequency,
      imageQuality: config.imageQuality,
      cacheSize: config.cacheSize,
      showNotifications: config.showNotifications,
      isLoading: false,
      apiKey: '',
      isApiKeyVisible: false,
      cacheStats: null,
    };
  }

  componentDidMount() {
    this.loadCacheStats();
  }

  loadCacheStats = async () => {
    try {
      const stats = await aiIllustrationService.getCacheStats();
      this.setState({
        cacheStats: {
          totalEntries: stats.combined.totalUniqueKeys,
          estimatedSizeBytes: stats.memory.estimatedSizeBytes + stats.persistent.estimatedSizeBytes,
          memoryHitRate: stats.combined.memoryHitRate,
        },
      });
    } catch (error) {
      console.warn('Failed to load cache stats:', error);
    }
  };

  handleToggleEnabled = () => {
    const newEnabled = !this.state.isEnabled;
    this.setState({ isEnabled: newEnabled });
    
    AIIllustrationConfigService.updateConfig({ enabled: newEnabled });
    toast.success(this.props.t("Change successful"));
  };

  handleFrequencyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const frequency = event.target.value as 'every-page' | 'every-second-page' | 'every-third-page';
    this.setState({ frequency });
    
    AIIllustrationConfigService.updateConfig({ frequency });
    toast.success(this.props.t("Change successful"));
  };

  handleQualityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const imageQuality = event.target.value as 'standard' | 'high';
    this.setState({ imageQuality });
    
    AIIllustrationConfigService.updateConfig({ imageQuality });
    toast.success(this.props.t("Change successful"));
  };

  handleCacheSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const cacheSize = parseInt(event.target.value);
    if (cacheSize >= 10 && cacheSize <= 1000) {
      this.setState({ cacheSize });
      AIIllustrationConfigService.updateConfig({ cacheSize });
      toast.success(this.props.t("Change successful"));
    }
  };

  handleNotificationsToggle = () => {
    const newShowNotifications = !this.state.showNotifications;
    this.setState({ showNotifications: newShowNotifications });
    
    AIIllustrationConfigService.updateConfig({ showNotifications: newShowNotifications });
    toast.success(this.props.t("Change successful"));
  };

  handleClearCache = async () => {
    this.setState({ isLoading: true });
    
    try {
      await aiIllustrationService.clearCache();
      await this.loadCacheStats();
      toast.success(this.props.t("Cache cleared successfully"));
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error(this.props.t("Failed to clear cache"));
    } finally {
      this.setState({ isLoading: false });
    }
  };

  handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ apiKey: event.target.value });
  };

  handleApiKeySubmit = async () => {
    if (!this.state.apiKey.trim()) {
      toast.error(this.props.t("Please enter an API key"));
      return;
    }

    this.setState({ isLoading: true });
    
    try {
      const success = await aiApiService.setApiKey(this.state.apiKey.trim());
      if (success) {
        toast.success(this.props.t("API key saved successfully"));
        this.setState({ apiKey: '' }); // Clear the input for security
      } else {
        toast.error(this.props.t("Failed to save API key"));
      }
    } catch (error) {
      console.error('Failed to set API key:', error);
      toast.error(this.props.t("Failed to save API key"));
    } finally {
      this.setState({ isLoading: false });
    }
  };

  toggleApiKeyVisibility = () => {
    this.setState({ isApiKeyVisible: !this.state.isApiKeyVisible });
  };

  formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  render() {
    const { cacheStats } = this.state;

    return (
      <div className="ai-illustration-settings">
        <div className="ai-illustration-settings-title">
          <Trans>AI Illustrations</Trans>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="single-control-switch-container">
          <span className="single-control-switch-title">
            <Trans>Enable AI illustrations</Trans>
          </span>
          <span
            className="single-control-switch"
            onClick={this.handleToggleEnabled}
            style={this.state.isEnabled ? {} : { opacity: 0.6 }}
          >
            <span
              className="single-control-button"
              style={
                this.state.isEnabled
                  ? {
                      transform: "translateX(20px)",
                      transition: "transform 0.5s ease",
                    }
                  : {
                      transform: "translateX(0px)",
                      transition: "transform 0.5s ease",
                    }
              }
            ></span>
          </span>
        </div>
        <p className="setting-option-subtitle">
          <Trans>Generate contextual illustrations for your books using AI</Trans>
        </p>

        {/* API Key Configuration */}
        <div className="ai-setting-item">
          <span className="ai-setting-label">
            <Trans>Hyperbolic API Key</Trans>
          </span>
          <div className="ai-api-key-container">
            <input
              type={this.state.isApiKeyVisible ? "text" : "password"}
              className="ai-setting-input"
              placeholder={this.props.t("Enter your Hyperbolic API key")}
              value={this.state.apiKey}
              onChange={this.handleApiKeyChange}
              disabled={this.state.isLoading}
            />
            <button
              className="ai-api-key-toggle"
              onClick={this.toggleApiKeyVisibility}
              type="button"
            >
              {this.state.isApiKeyVisible ? "👁️" : "👁️‍🗨️"}
            </button>
            <button
              className="ai-api-key-save"
              onClick={this.handleApiKeySubmit}
              disabled={this.state.isLoading || !this.state.apiKey.trim()}
            >
              <Trans>Save</Trans>
            </button>
          </div>
        </div>
        <p className="setting-option-subtitle">
          <Trans>Get your API key from</Trans>{" "}
          <a 
            href="https://app.hyperbolic.xyz/keys" 
            target="_blank" 
            rel="noopener noreferrer"
            className="ai-api-link"
          >
            https://app.hyperbolic.xyz/keys
          </a>
        </p>

        {this.state.isEnabled && (
          <>
            {/* Frequency Setting */}
            <div className="ai-setting-item">
              <span className="ai-setting-label">
                <Trans>Illustration frequency</Trans>
              </span>
              <select
                className="ai-setting-dropdown"
                value={this.state.frequency}
                onChange={this.handleFrequencyChange}
              >
                <option value="every-page">
                  {this.props.t("Every page")}
                </option>
                <option value="every-second-page">
                  {this.props.t("Every second page")}
                </option>
                <option value="every-third-page">
                  {this.props.t("Every third page")}
                </option>
              </select>
            </div>

            {/* Image Quality Setting */}
            <div className="ai-setting-item">
              <span className="ai-setting-label">
                <Trans>Image quality</Trans>
              </span>
              <select
                className="ai-setting-dropdown"
                value={this.state.imageQuality}
                onChange={this.handleQualityChange}
              >
                <option value="standard">
                  {this.props.t("Standard")}
                </option>
                <option value="high">
                  {this.props.t("High")}
                </option>
              </select>
            </div>

            {/* Cache Size Setting */}
            <div className="ai-setting-item">
              <span className="ai-setting-label">
                <Trans>Cache size (MB)</Trans>
              </span>
              <input
                type="number"
                className="ai-setting-input"
                min="10"
                max="1000"
                value={this.state.cacheSize}
                onChange={this.handleCacheSizeChange}
              />
            </div>

            {/* Notifications Toggle */}
            <div className="single-control-switch-container">
              <span className="single-control-switch-title">
                <Trans>Show error notifications</Trans>
              </span>
              <span
                className="single-control-switch"
                onClick={this.handleNotificationsToggle}
                style={this.state.showNotifications ? {} : { opacity: 0.6 }}
              >
                <span
                  className="single-control-button"
                  style={
                    this.state.showNotifications
                      ? {
                          transform: "translateX(20px)",
                          transition: "transform 0.5s ease",
                        }
                      : {
                          transform: "translateX(0px)",
                          transition: "transform 0.5s ease",
                        }
                  }
                ></span>
              </span>
            </div>
            <p className="setting-option-subtitle">
              <Trans>Show notifications when AI illustration generation fails</Trans>
            </p>

            {/* Cache Management */}
            <div className="ai-cache-management">
              <div className="ai-cache-title">
                <Trans>Cache Management</Trans>
              </div>
              
              {cacheStats && (
                <div className="ai-cache-stats">
                  <div className="ai-cache-stat">
                    <span className="ai-cache-stat-label">
                      <Trans>Total illustrations</Trans>:
                    </span>
                    <span className="ai-cache-stat-value">
                      {cacheStats.totalEntries}
                    </span>
                  </div>
                  <div className="ai-cache-stat">
                    <span className="ai-cache-stat-label">
                      <Trans>Cache size</Trans>:
                    </span>
                    <span className="ai-cache-stat-value">
                      {this.formatBytes(cacheStats.estimatedSizeBytes)}
                    </span>
                  </div>
                  <div className="ai-cache-stat">
                    <span className="ai-cache-stat-label">
                      <Trans>Hit rate</Trans>:
                    </span>
                    <span className="ai-cache-stat-value">
                      {(cacheStats.memoryHitRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              <button
                className="ai-clear-cache-button"
                onClick={this.handleClearCache}
                disabled={this.state.isLoading}
              >
                {this.state.isLoading ? (
                  <Trans>Clearing...</Trans>
                ) : (
                  <Trans>Clear Cache</Trans>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }
}

export default AIIllustrationSettings;