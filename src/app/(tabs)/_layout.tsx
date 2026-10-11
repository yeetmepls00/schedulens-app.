import { Tabs } from 'expo-router';
import { TabBar } from '../../components/ui';

const TABS = [
  { name: 'index' },
  { name: 'calendar' },
  { name: 'groups' },
  { name: 'scan' },
  { name: 'vault' },
];

const renderTabBar = (props: any) => <TabBar {...props} />;

export default function TabLayout() {
  return (
    <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} />
      ))}
    </Tabs>
  );
}