import React from 'react';

export default function TimeSelector({ value, onChange, minTime, disabled, label = "Time" }) {
  // Ensure value is valid, default to "00:00" if invalid
  const validValue = value && value.includes(':') ? value : "00:00";
  const [hours, minutes] = validValue.split(':').map(Number);
  
  // Generate hours (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  
  // Generate minutes in 5-minute intervals (0, 5, 10, ..., 55)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  // Parse minTime if provided
  let minHour = 0;
  let minMinute = 0;
  if (minTime) {
    const parts = minTime.split(':');
    if (parts.length === 2) {
      minHour = parseInt(parts[0], 10) || 0;
      minMinute = parseInt(parts[1], 10) || 0;
    }
  }

  const handleHourChange = (e) => {
    const newHour = parseInt(e.target.value, 10);
    let newMinute = minutes;
    
    // If the new hour equals minHour, ensure minutes are not less than minMinute
    if (minTime && newHour === minHour && newMinute < minMinute) {
      // Round up to nearest 5-minute interval >= minMinute
      newMinute = Math.ceil(minMinute / 5) * 5;
      if (newMinute >= 60) {
        newMinute = 0;
      }
    }
    
    const newValue = `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
    onChange(newValue);
  };

  const handleMinuteChange = (e) => {
    const newMinute = parseInt(e.target.value, 10);
    const newValue = `${String(hours).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
    onChange(newValue);
  };

  // Check if an hour option should be disabled
  const isHourDisabled = (hour) => {
    if (!minTime) return false;
    return hour < minHour;
  };

  // Check if a minute option should be disabled
  const isMinuteDisabled = (minute) => {
    if (!minTime) return false;
    if (hours > minHour) return false;
    if (hours === minHour) {
      return minute < minMinute;
    }
    return false;
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div className="time-selector-container">
        <select
          value={hours}
          onChange={handleHourChange}
          disabled={disabled}
        >
          {hourOptions.map(h => (
            <option key={h} value={h} disabled={isHourDisabled(h)}>
              {String(h).padStart(2, '0')}
            </option>
          ))}
        </select>
        <span className="time-separator">:</span>
        <select
          value={minutes}
          onChange={handleMinuteChange}
          disabled={disabled}
        >
          {minuteOptions.map(m => (
            <option key={m} value={m} disabled={isMinuteDisabled(m)}>
              {String(m).padStart(2, '0')}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}