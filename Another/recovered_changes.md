diff --git a/pbms-fe/src/features/customer/PreBookingScreen.tsx 
b/pbms-fe/src/features/customer/PreBookingScreen.tsx
index 7402cc6..35616e0 100644
--- 
a/pbms-fe/src/features/customer/PreBookingScreen.tsx
+++ b/pbms-fe/src/features/customer/PreBookingScreen.tsx
@@ 
-32,12 +32,12 @@ export const PreBookingScreen = () => {
     refreshSimulatedOffset();
   }, []);
 
-  // Fetch 
System Configs
-  const { data: configsData } = useQuery({
-    queryKey: ['system-configs'],
+  // Fetch Building 
Profile (Public info for customers)
+  const { data: buildingProfileData } = useQuery({
+    queryKey: 
['public-building-profile'],
     queryFn: async () => {
       try {
-        const res = await 
axiosClient.get('/system/configs');
+        const res = await axiosClient.get('/public/building-profile');
         
return res.data.data;
       } catch (err) {
         return null;
@@ -45,6 +45,7 @@ export const PreBookingScreen 
= () => {
     }
   });
 
+  // Fetch System Configs
   const { data: earlyMinsData } = useQuery({
     
queryKey: ['public-config-early-mins'],
     queryFn: async () => {
@@ -59,10 +60,40 @@ export const 
PreBookingScreen = () => {
 
   const earlyMins = React.useMemo(() => {
     if (earlyMinsData !== undefined) 
return earlyMinsData;
-    if (!configsData) return 30;
-    const config = configsData.find((c: any) => c.configKey 
=== 'RESERVATION_EARLY_MINS');
-    return config && config.configValue ? parseInt(config.configValue, 10) : 30;
-  
}, [configsData, earlyMinsData]);
+    return 30;
+  }, [earlyMinsData]);
+
+  const operatingHours = 
React.useMemo(() => {
+    if (!buildingProfileData) return { is247: false, start: '06:00', end: '22:30' };
+    
return {
+      is247: buildingProfileData.is247 ?? false,
+      start: buildingProfileData.operatingStart || 
'06:00',
+      end: buildingProfileData.operatingEnd || '22:30'
+    };
+  }, [buildingProfileData]);
+
+  const 
isOutOfOperatingHours = React.useMemo(() => {
+    if (operatingHours.is247) return false;
+    
+    const 
parseTime = (timeStr: string) => {
+      const [h, m] = timeStr.split(':').map(Number);
+      return h * 60 + 
m;
+    };
+    
+    const startMins = parseTime(operatingHours.start);
+    const endMins = 
parseTime(operatingHours.end);
+    const arrivalTimeOfDayMins = arrivalTime.hour() * 60 + arrivalTime.minute();
+   
 const endTimeOfDayMins = endTime.hour() * 60 + endTime.minute();
+    
+    // Check if arrivalTime or endTime 
falls outside the operating window
+    // (Assuming start < end, e.g. 06:00 < 22:30)
+    if (startMins < endMins) 
{
+      if (arrivalTimeOfDayMins < startMins || arrivalTimeOfDayMins >= endMins) return true;
+      // if it 
crosses the next day or crosses closing time
+      if (endTime.isAfter(arrivalTime, 'day') || endTimeOfDayMins > 
endMins) return true;
+    }
+    return false;
+  }, [arrivalTime, endTime, operatingHours]);
 
   useEffect(() 
=> {
     // If the offset changes (e.g., initial fetch from server), update the selected times
@@ -105,11 +136,22 
@@ export const PreBookingScreen = () => {
   });
 
   const allZones = zonesData || [];
-  const vehicleType = 
VEHICLES.find((v: any) => v.id === selectedVehicle)?.typeName;
+  const vehicle = VEHICLES.find((v: any) => v.id === 
selectedVehicle);
+  const vehicleType = vehicle?.typeName;
+  const vehicleCategory = vehicle?.category; // 
FOUR_WHEEL or TWO_WHEEL
+
   const filteredZones = allZones.filter((z: any) => {
     if (z.functionType !== 
'WALK_IN') return false;
     if (!selectedVehicle) return true;
-    if (z.vehicleTypeId) return z.vehicleTypeId 
=== selectedVehicle;
+    
+    // Exact match
+    if (z.vehicleTypeId === selectedVehicle) return true;
+    
+ 
   // Category match (e.g. Electric Car can park in FOUR_WHEEL zone)
+    const zoneVehicleObj = VEHICLES.find((v: 
any) => v.id === z.vehicleTypeId);
+    const zoneCategory = zoneVehicleObj?.category;
+    if (vehicleCategory && 
zoneCategory && vehicleCategory === zoneCategory) return true;
+    
     // Fallback if backend hasn't been 
restarted yet and vehicleTypeId is missing
     return z.vehicleType === vehicleType || (z.vehicleType && vehicleType 
&& z.vehicleType.substring(0, 3) === vehicleType.substring(0, 3));
   });

