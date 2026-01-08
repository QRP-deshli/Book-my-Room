import React, { useState, useEffect } from 'react';

export default function UserSettings({ token, apiUrl, userProfile, onProfileUpdate }) {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadBuildings();
  }, []);

  useEffect(() => {
    if (userProfile) {
      setSelectedBuilding(userProfile.building_id || '');
      setUserName(userProfile.name || '');
    }
  }, [userProfile]);

  const loadBuildings = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/buildings`);
      const data = await res.json();
      setBuildings(data.buildings || []);
    } catch (err) {
      console.error('Error loading buildings:', err);
    }
  };

  const handleUpdateBuilding = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/user/update-building`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          building_id: selectedBuilding || null 
        })
      });

      const data = await res.json();

      if (res.ok) {
        alert('✅ Building updated successfully');
        if (onProfileUpdate) {
          onProfileUpdate();
        }
      } else {
        alert(`❌ ${data.error || 'Failed to update building'}`);
      }
    } catch (err) {
      console.error('Error updating building:', err);
      alert('❌ Server error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (loading) return;

    const trimmedName = userName.trim();
    if (!trimmedName) {
      alert('❌ Name cannot be empty');
      return;
    }

    if (trimmedName.length > 100) {
      alert('❌ Name is too long (max 100 characters)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/user/update-name`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: trimmedName })
      });

      const data = await res.json();

      if (res.ok) {
        alert('✅ Name updated successfully');
        if (onProfileUpdate) {
          onProfileUpdate();
        }
      } else {
        alert(`❌ ${data.error || 'Failed to update name'}`);
      }
    } catch (err) {
      console.error('Error updating name:', err);
      alert('❌ Server error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (loading) return;

    const nameChanged = userName.trim() !== (userProfile?.name || '');
    const buildingChanged = selectedBuilding !== (userProfile?.building_id || '');

    if (!nameChanged && !buildingChanged) {
      alert('ℹ️ No changes to save');
      return;
    }

    if (nameChanged) {
      await handleUpdateName();
    }

    if (buildingChanged && !nameChanged) {
      await handleUpdateBuilding();
    } else if (buildingChanged) {
      // Small delay between requests
      setTimeout(handleUpdateBuilding, 300);
    }
  };

  const hasChanges = 
    userName.trim() !== (userProfile?.name || '') ||
    selectedBuilding !== (userProfile?.building_id || '');

  return (
    <div className="card user-settings-card">
      <div 
        className="user-settings-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3>⚙️ My Settings</h3>
        <button className="btn-toggle">
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="user-settings-body">
          <div className="field">
            <label>My Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={loading}
              placeholder="Enter your name"
              maxLength={100}
            />
          </div>

          <div className="field">
            <label>My Working Building</label>
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              disabled={loading}
            >
              <option value="">-- No Building Assigned --</option>
              {buildings.map(b => (
                <option key={b.building_id} value={b.building_id}>
                  {b.address}, {b.city}
                </option>
              ))}
            </select>
          </div>

          <div className="user-settings-info">
            <p>
              💡 Setting your building helps you quickly filter rooms in your location.
            </p>
          </div>

          {hasChanges && (
            <button 
              className="btn-primary"
              onClick={handleSaveAll}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}