import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Clock,
  Settings,
  LogOut,
  Menu,
  Building2,
  List
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavigationProps {
  title?: string;
  subtitle?: string;
}

export default function Navigation({ title, subtitle }: NavigationProps) {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!isAuthenticated) return null;
  
  // For staff users, don't show navigation at all
  if ((user as any)?.role !== "admin") {
    return null;
  }

  const isAdmin = (user as any)?.role === "admin";
  const userDisplayName = (user as any)?.firstName || (user as any)?.email?.split("@")[0] || "User";

  const navigationItems = isAdmin ? [
    { icon: LayoutDashboard, label: "Dashboard", path: "/", active: location === "/" },
    { icon: List, label: "All Jobs", path: "/jobs", active: location === "/jobs" },
    { icon: FileText, label: "Timesheet", path: "/timesheet", active: location === "/timesheet" },
  ] : [
    { icon: FileText, label: "Daily Timesheet", path: "/", active: location === "/" || location === "/timesheet" },
  ];

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left side - Logo and Navigation */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Building2 className="h-8 w-8 text-primary mr-3" />
              <span className="text-xl font-bold text-gray-900">BuildFlow Pro</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:ml-8 md:flex md:space-x-4">
              {navigationItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    item.active
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Center - Page Title */}
          {(title || subtitle) && (
            <div className="hidden md:flex md:items-center md:justify-center flex-1">
              <div className="text-center">
                {title && <h1 className="text-lg font-semibold text-gray-900">{title}</h1>}
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
              </div>
            </div>
          )}

          {/* Right side - User Menu */}
          <div className="flex items-center space-x-4">
            {/* User Role Badge */}
            <Badge variant={isAdmin ? "default" : "secondary"} className="hidden md:inline-flex">
              {isAdmin ? "Admin" : "Staff"}
            </Badge>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {userDisplayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden md:block text-sm font-medium">{userDisplayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start space-x-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{userDisplayName}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      {(user as any)?.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <DropdownMenu open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {navigationItems.map((item) => (
                    <DropdownMenuItem
                      key={item.path}
                      onClick={() => {
                        setLocation(item.path);
                        setIsMobileMenuOpen(false);
                      }}
                      className={item.active ? "bg-primary/10" : ""}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.label}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Badge variant={isAdmin ? "default" : "secondary"} className="mr-2">
                      {isAdmin ? "Admin" : "Staff"}
                    </Badge>
                    <span className="text-sm">{userDisplayName}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}