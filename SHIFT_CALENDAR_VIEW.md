# Shift Calendar View

## Overview
The Beach Safety App now includes a comprehensive calendar view for shift scheduling, providing an intuitive visual interface for managing lifeguard shifts alongside the existing list view.

## Features

### 1. Dual View Modes
- **List View**: Traditional table-based view with pagination
- **Calendar View**: Visual calendar interface with week/month views
- **Easy Toggle**: Switch between views using the toggle buttons in the header

### 2. Calendar View Features

#### Week View
- Displays a full week (Monday to Sunday)
- Shows all shifts for each day in compact cards
- Color-coded by shift status
- Easy navigation with previous/next week buttons

#### Month View
- Full month calendar layout
- Shows shifts across the entire month
- Maintains visual consistency with week view
- Efficient for long-term planning

### 3. Interactive Elements

#### Shift Cards
- **Lifeguard Avatar**: Shows first initial of lifeguard name
- **Time Display**: Start and end times clearly shown
- **Status Indicators**: Color-coded chips with status icons
- **Hover Effects**: Cards lift and show shadow on hover
- **Click Actions**: Click any shift to view details

#### Day Cells
- **Current Day Highlighting**: Today's date is highlighted
- **Click to Create**: Click any empty day to create a new shift
- **Pre-filled Times**: New shifts default to 9 AM - 5 PM
- **Visual Feedback**: Hover effects on day cells

### 4. Navigation Controls

#### Calendar Header
- **Previous/Next Buttons**: Navigate between weeks/months
- **Today Button**: Quick return to current date
- **View Toggle**: Switch between week and month views
- **Date Range Display**: Shows current week/month range

#### List View Controls
- **Pagination**: Navigate through large lists
- **Rows Per Page**: Adjustable table size
- **Sorting**: Maintains existing table functionality

## Technical Implementation

### Components

#### ShiftCalendar.tsx
- **Location**: `frontend/src/components/admin/ShiftCalendar.tsx`
- **Purpose**: Main calendar view component
- **Features**:
  - Week/month view modes
  - Date navigation
  - Shift rendering
  - Interactive elements

#### ShiftScheduling.tsx (Updated)
- **Location**: `frontend/src/components/admin/ShiftScheduling.tsx`
- **Changes**:
  - Added view mode toggle
  - Integrated calendar component
  - Enhanced date handling
  - Improved user experience

### Key Features

#### Date Handling
```typescript
// Week view date range
const dateRange = {
  start: startOfWeek(currentDate, { weekStartsOn: 1 }), // Monday start
  end: endOfWeek(currentDate, { weekStartsOn: 1 })
};

// Month view date range
const dateRange = {
  start: startOfMonth(currentDate),
  end: endOfMonth(currentDate)
};
```

#### Shift Filtering
```typescript
const getShiftsForDay = (date: Date) => {
  return shifts.filter(shift => {
    const shiftStart = parseISO(shift.start_time);
    const shiftEnd = parseISO(shift.end_time);
    
    return (
      isSameDay(shiftStart, date) ||
      isSameDay(shiftEnd, date) ||
      (isBefore(shiftStart, date) && isAfter(shiftEnd, date))
    );
  });
};
```

#### Visual Styling
- **Status Colors**: 
  - Scheduled: Blue (#1976d2)
  - Active: Green (#2e7d32)
  - Completed: Blue (#0288d1)
  - Cancelled: Red (#d32f2f)
- **Current Day**: Highlighted with primary color
- **Hover Effects**: Smooth transitions and shadows

## User Experience

### 1. Default View
- **Calendar View**: Set as the default view for better visual planning
- **Week View**: Default calendar mode for detailed daily planning
- **Responsive Design**: Works on desktop and tablet devices

### 2. Quick Actions
- **Click Day**: Create new shift for selected date
- **Click Shift**: View shift details
- **Navigation**: Easy week/month navigation
- **Today**: Quick return to current date

### 3. Visual Feedback
- **Status Indicators**: Clear visual status representation
- **Overdue Alerts**: Visual indicators for overdue shifts
- **Empty States**: Clear messaging when no shifts exist
- **Loading States**: Smooth loading transitions

## Benefits

### 1. Improved Planning
- **Visual Overview**: See all shifts at a glance
- **Gap Identification**: Easily spot empty time slots
- **Conflict Detection**: Visual overlap identification
- **Long-term Planning**: Month view for extended planning

### 2. Enhanced User Experience
- **Intuitive Interface**: Familiar calendar layout
- **Quick Actions**: One-click shift creation
- **Visual Hierarchy**: Clear information organization
- **Responsive Design**: Works across devices

### 3. Better Management
- **Efficient Navigation**: Quick date jumping
- **Status Overview**: Visual status representation
- **Time Management**: Clear time slot visualization
- **Team Coordination**: Easy shift overview

## Usage Instructions

### Switching Views
1. Navigate to **Center Admin → Shift Scheduling**
2. Use the toggle buttons in the header:
   - **List View**: Traditional table format
   - **Calendar View**: Visual calendar interface

### Calendar Navigation
1. **Week View**: Use left/right arrows to navigate weeks
2. **Month View**: Use left/right arrows to navigate months
3. **Today Button**: Quick return to current date
4. **View Toggle**: Switch between week and month views

### Creating Shifts
1. **From Calendar**: Click any day cell to create a shift
2. **From List**: Use the "Schedule Shift" button
3. **Pre-filled Times**: Calendar creates default 9 AM - 5 PM shifts
4. **Quick Edit**: Modify times and details in the dialog

### Viewing Shift Details
1. **Calendar**: Click any shift card to view details
2. **List**: Use the view button in the actions column
3. **Same Dialog**: Consistent detail view across both modes

## Technical Details

### Dependencies
- **date-fns**: Date manipulation and formatting
- **Material-UI**: UI components and styling
- **React**: Component framework
- **TypeScript**: Type safety

### Performance
- **Memoized Calculations**: Efficient date range calculations
- **Optimized Rendering**: Minimal re-renders
- **Lazy Loading**: Efficient shift filtering
- **Responsive Design**: Mobile-friendly layout

### Accessibility
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Proper ARIA labels
- **Color Contrast**: WCAG compliant colors
- **Focus Management**: Proper focus handling

## Future Enhancements

### Potential Improvements
1. **Drag & Drop**: Move shifts between days
2. **Multi-select**: Select multiple shifts for bulk actions
3. **Filtering**: Filter by lifeguard or status
4. **Export**: Export calendar view to PDF
5. **Notifications**: Visual alerts for conflicts
6. **Integration**: Sync with external calendars

The calendar view provides a modern, intuitive interface for shift management while maintaining all existing functionality of the list view. 