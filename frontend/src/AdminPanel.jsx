import React, { useState, useEffect } from 'react';

export default function AdminPanel({ token, apiUrl }) {
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    role: 'viewer',
    building_id: '' 
  });
  const [newRoom, setNewRoom] = useState({ room_number: '', capacity: '', floor: '', building_id: '1' });
  
  // Selection states
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedUserForRole, setSelectedUserForRole] = useState('');
  const [newRole, setNewRole] = useState('viewer');

  // NEW: User details modification states
  const [selectedUserForDetails, setSelectedUserForDetails] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserBuilding, setNewUserBuilding] = useState('');

  // Load users, rooms, and buildings
  useEffect(() => {
    loadUsers();
    loadRooms();
    loadBuildings();
  }, []);

  // NEW: Update form when user is selected for details modification
  useEffect(() => {
    if (selectedUserForDetails) {
      const user = users.find(u => u.user_id === Number(selectedUserForDetails));
      if (user) {
        setNewUserName(user.name || '');
        setNewUserBuilding(user.building_id || '');
      }
    } else {
      setNewUserName('');
      setNewUserBuilding('');
    }
  }, [selectedUserForDetails, users]);

  const loadBuildings = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/buildings`);
      const data = await res.json();
      setBuildings(data.buildings || []);
    } catch (err) {
      console.error('Error loading buildings:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadRooms = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/rooms?localDate=2025-01-01&localTime=00:00`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (err) {
      console.error('Error loading rooms:', err);
    }
  };

  // Add User
  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.role) {
      alert('❌ All fields are required');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/admin/add-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newUser,
          building_id: newUser.building_id || null
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(`✅ User '${newUser.name}' added successfully`);
        setNewUser({ name: '', email: '', role: 'viewer', building_id: '' });
        loadUsers();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    }
  };

  // Add Room
  const handleAddRoom = async () => {
    if (!newRoom.room_number || !newRoom.capacity || !newRoom.floor || !newRoom.building_id) {
      alert('❌ All fields are required');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/admin/add-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newRoom,
          capacity: Number(newRoom.capacity),
          floor: Number(newRoom.floor),
          building_id: Number(newRoom.building_id)
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        alert(`✅ Room '${newRoom.room_number}' added successfully`);
        setNewRoom({ room_number: '', capacity: '', floor: '', building_id: '1' });
        loadRooms();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    }
  };

  // Delete User
  const handleDeleteUser = async () => {
    if (!selectedUserId) {
      alert('❌ Please select a user to delete');
      return;
    }

    const user = users.find(u => u.user_id === Number(selectedUserId));
    if (!window.confirm(`Delete user '${user.name}' (${user.email})?`)) return;

    try {
      const res = await fetch(`${apiUrl}/api/admin/delete-user/${selectedUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        alert('✅ User deleted successfully');
        setSelectedUserId('');
        loadUsers();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    }
  };

  // Delete Room
  const handleDeleteRoom = async () => {
    if (!selectedRoomId) {
      alert('❌ Please select a room to delete');
      return;
    }

    const room = rooms.find(r => r.room_id === Number(selectedRoomId));
    if (!window.confirm(`Delete room '${room.room_number}'?`)) return;

    try {
      const res = await fetch(`${apiUrl}/api/admin/delete-room/${selectedRoomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        alert('✅ Room deleted successfully');
        setSelectedRoomId('');
        loadRooms();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    }
  };

  // Modify Role
  const handleModifyRole = async () => {
    if (!selectedUserForRole) {
      alert('❌ Please select a user');
      return;
    }

    const user = users.find(u => u.user_id === Number(selectedUserForRole));
    if (!window.confirm(`Change role for '${user.name}' to '${newRole}'?`)) return;

    try {
      const res = await fetch(`${apiUrl}/api/admin/change-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: selectedUserForRole, role: newRole })
      });
      const data = await res.json();
      
      if (res.ok) {
        alert('✅ Role updated successfully');
        setSelectedUserForRole('');
        loadUsers();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    }
  };

  // NEW: Modify User Details (Name and Building)
  const handleModifyUserDetails = async () => {
    if (!selectedUserForDetails) {
      alert('❌ Please select a user');
      return;
    }

    const user = users.find(u => u.user_id === Number(selectedUserForDetails));
    
    if (!newUserName.trim()) {
      alert('❌ Name cannot be empty');
      return;
    }

    if (newUserName.trim().length > 100) {
      alert('❌ Name is too long (max 100 characters)');
      return;
    }

    // Check if anything changed
    const nameChanged = newUserName.trim() !== user.name;
    const buildingChanged = String(newUserBuilding) !== String(user.building_id || '');

    if (!nameChanged && !buildingChanged) {
      alert('ℹ️ No changes to save');
      return;
    }

    let confirmMsg = `Update details for '${user.name}'?`;
    if (nameChanged) confirmMsg += `\n• New name: ${newUserName.trim()}`;
    if (buildingChanged) {
      const building = buildings.find(b => b.building_id === Number(newUserBuilding));
      confirmMsg += `\n• New building: ${building ? `${building.address}, ${building.city}` : 'None'}`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${apiUrl}/api/admin/update-user-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          user_id: selectedUserForDetails,
          name: newUserName.trim(),
          building_id: newUserBuilding || null
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        alert('✅ User details updated successfully');
        setSelectedUserForDetails('');
        setNewUserName('');
        setNewUserBuilding('');
        loadUsers();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    }
  };

  // CSV Import Users
  const handleImportUsers = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('❌ Please select a CSV file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiUrl}/api/admin/import-users-csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        let message = `✅ CSV imported: ${data.summary.usersAdded} users added`;
        if (data.summary.usersSkipped > 0) {
          message += `, ${data.summary.usersSkipped} skipped (already exist)`;
        }
        alert(message);
        loadUsers();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // CSV Import Rooms
  const handleImportRooms = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('❌ Please select a CSV file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiUrl}/api/admin/import-rooms-csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        let message = `✅ CSV imported: ${data.summary.roomsAdded} rooms added`;
        if (data.summary.roomsSkipped > 0) {
          message += `, ${data.summary.roomsSkipped} skipped (already exist)`;
        }
        alert(message);
        loadRooms();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // CSV Export Users
  const handleExportUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/export-users-csv`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        alert('✅ Users exported successfully');
      } else {
        const data = await res.json();
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    } finally {
      setLoading(false);
    }
  };

  // CSV Export Rooms
  const handleExportRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/export-rooms-csv`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rooms_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        alert('✅ Rooms exported successfully');
      } else {
        const data = await res.json();
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('❌ Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-section">
      {/* CSV Management - Users */}
      <div className="card">
        <h3>Users CSV Management</h3>
        <div className="admin-csv-actions">
          <label className="btn-primary btn-file-label">
            {loading ? 'Processing...' : '📂 Import Users CSV'}
            <input
              type="file"
              accept=".csv"
              onChange={handleImportUsers}
              disabled={loading}
            />
          </label>
          <button 
            className="btn-primary" 
            onClick={handleExportUsers}
            disabled={loading}
          >
            💾 Export Users CSV
          </button>
        </div>
        <p className="admin-csv-hint">
          CSV format: name, email, role, building_id (optional)
        </p>
      </div>

      {/* CSV Management - Rooms */}
      <div className="card">
        <h3>Rooms CSV Management</h3>
        <div className="admin-csv-actions">
          <label className="btn-primary btn-file-label">
            {loading ? 'Processing...' : '📂 Import Rooms CSV'}
            <input
              type="file"
              accept=".csv"
              onChange={handleImportRooms}
              disabled={loading}
            />
          </label>
          <button 
            className="btn-primary" 
            onClick={handleExportRooms}
            disabled={loading}
          >
            💾 Export Rooms CSV
          </button>
        </div>
        <p className="admin-csv-hint">
          CSV format: room_number, capacity, floor, building_id
        </p>
      </div>

      {/* Add User */}
      <div className="card">
        <h3>Add New User</h3>
        <div className="admin-form">
          <div className="field">
            <label>Name</label>
            <input
              type="text"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              placeholder="John Doe"
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="john@example.com"
            />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              <option value="viewer">Viewer</option>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label>Working Building (Optional)</label>
            <select 
              value={newUser.building_id} 
              onChange={(e) => setNewUser({ ...newUser, building_id: e.target.value })}
            >
              <option value="">-- None --</option>
              {buildings.map(b => (
                <option key={b.building_id} value={b.building_id}>
                  {b.address}, {b.city}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleAddUser} className="btn-primary">Add User</button>
        </div>
      </div>

      {/* Add Room */}
      <div className="card">
        <h3>Add New Room</h3>
        <div className="admin-form">
          <div className="field">
            <label>Room Number</label>
            <input
              type="text"
              value={newRoom.room_number}
              onChange={(e) => setNewRoom({ ...newRoom, room_number: e.target.value })}
              placeholder="A101"
            />
          </div>
          <div className="field">
            <label>Capacity</label>
            <input
              type="number"
              value={newRoom.capacity}
              onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
              placeholder="10"
            />
          </div>
          <div className="field">
            <label>Floor</label>
            <input
              type="number"
              value={newRoom.floor}
              onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })}
              placeholder="1"
            />
          </div>
          <div className="field">
            <label>Building</label>
            <select
              value={newRoom.building_id}
              onChange={(e) => setNewRoom({ ...newRoom, building_id: e.target.value })}
            >
              {buildings.map(b => (
                <option key={b.building_id} value={b.building_id}>
                  {b.address}, {b.city}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleAddRoom} className="btn-primary">Add Room</button>
        </div>
      </div>

      {/* NEW: Modify User Details (Name and Building) */}
      <div className="card">
        <h3>🔧 Modify User Details</h3>
        <div className="admin-form">
          <div className="field">
            <label>Select User</label>
            <select 
              value={selectedUserForDetails} 
              onChange={(e) => setSelectedUserForDetails(e.target.value)}
            >
              <option value="">-- Choose a user --</option>
              {users.map(u => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name} ({u.email}) - {u.role_name}
                  {u.building_id && ` - ${u.address}, ${u.city}`}
                </option>
              ))}
            </select>
          </div>

          {selectedUserForDetails && (
            <>
              <div className="field">
                <label>New Name</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Enter new name"
                  maxLength={100}
                />
              </div>

              <div className="field">
                <label>New Building</label>
                <select
                  value={newUserBuilding}
                  onChange={(e) => setNewUserBuilding(e.target.value)}
                >
                  <option value="">-- No Building --</option>
                  {buildings.map(b => (
                    <option key={b.building_id} value={b.building_id}>
                      {b.address}, {b.city}
                    </option>
                  ))}
                </select>
              </div>

              <button className="btn-primary" onClick={handleModifyUserDetails}>
                Update User Details
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete User */}
      <div className="card">
        <h3>Delete User</h3>
        <div className="admin-form">
          <div className="field">
            <label>Select User</label>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">-- Choose a user --</option>
              {users.map(u => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name} ({u.email}) - {u.role_name}
                  {u.building_id && ` - ${u.address}, ${u.city}`}
                </option>
              ))}
            </select>
          </div>
          <button 
            className="btn-secondary btn-delete" 
            onClick={handleDeleteUser}
          >
            Delete User
          </button>
        </div>
      </div>

      {/* Delete Room */}
      <div className="card">
        <h3>Delete Room</h3>
        <div className="admin-form">
          <div className="field">
            <label>Select Room</label>
            <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)}>
              <option value="">-- Choose a room --</option>
              {rooms.map(r => (
                <option key={r.room_id} value={r.room_id}>
                  {r.room_number} - Capacity: {r.capacity}, Floor: {r.floor}
                </option>
              ))}
            </select>
          </div>
          <button 
            className="btn-secondary btn-delete" 
            onClick={handleDeleteRoom}
          >
            Delete Room
          </button>
        </div>
      </div>

      {/* Modify Role */}
      <div className="card">
        <h3>Modify User Role</h3>
        <div className="admin-form">
          <div className="field">
            <label>Select User</label>
            <select value={selectedUserForRole} onChange={(e) => setSelectedUserForRole(e.target.value)}>
              <option value="">-- Choose a user --</option>
              {users.map(u => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name} ({u.email}) - Current: {u.role_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>New Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="viewer">Viewer</option>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn-primary" onClick={handleModifyRole}>
            Update Role
          </button>
        </div>
      </div>
    </div>
  );
}