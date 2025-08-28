import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { DocumentExpenseProcessor } from "./components/DocumentExpenseProcessor";

// Minimal test app for GST functionality
function TestApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>GST Test - Document Expense Processor</h1>
        <DocumentExpenseProcessor />
      </div>
    </QueryClientProvider>
  );
}

export default TestApp;