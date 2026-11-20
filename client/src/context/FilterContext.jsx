import React, { createContext, useContext, useState } from 'react';

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [selectedProperty, setSelectedProperty] = useState('ALL'); // 'ALL' or property_code
  const [reportingDate, setReportingDate] = useState(''); // YYYY-MM-DD or empty for now
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  const refreshTimestamp = () => {
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  return (
    <FilterContext.Provider value={{
      selectedProperty,
      setSelectedProperty,
      reportingDate,
      setReportingDate,
      lastUpdated,
      refreshTimestamp,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}

