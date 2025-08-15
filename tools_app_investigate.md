
## Application Insights MCP Tools List

### Time-Series Correlation
**Command:** `azmcp monitor app correlate time`

  Perform a time-series correlation analysis based on a user-reported symptom on an Application Insights resource. This tool takes one or more data sets. Each data set consists of a table, filters and splitBy dimensions. The tool will construct time series of each data set split by the splitBy dimensions, then correlate the time series to find the most likely causes of the symptom. Example data sets: Determine which result code is contributing to the symptom: --data-sets: table:requests;filters:success=false;splitBy:resultCode Determine whether a specific exception is contributing to 500 errors: --data-sets: table:requests;filters:resultCode="500" table:exceptions;filters:type="System.InvalidOperationException" Determine which operation name is contributing to slow performance: --data-sets: table:requests;splitBy:operation_Name;aggregation:Average table:requests;splitBy:operation_Name;aggregation:95thPercentile Use this tool for investigating issues with Application Insights resources. Required options: - resource-name: The name of the Application Insights resource. or resource-id: The resource ID of the Application Insights resource. - symptom: The user-reported description of the problem occurring. Include as much detail as possible, including relevant details provided by the user such as result codes, operations, and time information. - data-sets: The data sets to include in the correlation analysis. This is a list of one or more strings formatted as follows (each string represents a data set to compare): table:"The name of the table to perform correlation analysis on. Should be a valid Application Insights table name";filters:"A comma-separated list of 'dimension=value'. Dimension names should be valid Application Insights column names";splitBy:"A single dimension to split by, or null (if data set should not be split). This should be a valid Application Insights column name.";aggregation:"The aggregation method to use. Default is 'Count'. Valid values are 'Count', 'Average' and '95thPercentile'." Optional options: - resource-group: The name of the Azure resource group containing the Application Insights resource. - start-time: The start time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to 24 hours ago. - end-time: The end time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to now.

  Parameters

  `symptom`The user-reported description of the problem occurring. Include as much detail as possible, including relevant details provided by the user such as result codes, operations, and time information.

  `start-time`The start time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to 24 hours ago.

  `end-time`The end time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to now.

  `data-sets*`The data sets to include in the correlation analysis. This is a list of one or more strings formatted as follows (each string represents a data set to compare): table:"The name of the table to perform correlation analysis on. Should be a valid Application Insights table name";filters:"A comma-separated list of 'dimension=value'. Dimension names should be valid Application Insights column names";splitBy:"A single dimension to split by, or null (if data set should not be split). This should be a valid Application Insights column name.";aggregation:"The aggregation method to use. Default is 'Count'. Valid values are 'Count', 'Average' and '95thPercentile'."

  `tenant`The Azure Active Directory tenant ID or name. This can be either the GUID identifier or the display name of your Azure AD tenant.

  `auth-method`Authentication method to use. Options: 'credential' (Azure CLI/managed identity), 'key' (access key), or 'connectionString'.

  `retry-delay`Initial delay in seconds between retry attempts. For exponential backoff, this value is used as the base.

  `retry-max-delay`Maximum delay in seconds between retries, regardless of the retry strategy.

  `retry-max-retries`Maximum number of retry attempts for failed operations before giving up.

  `retry-mode`Retry strategy to use. 'fixed' uses consistent delays, 'exponential' increases delay between attempts.

  `retry-network-timeout`Network operation timeout in seconds. Operations taking longer than this will be cancelled.

  `subscription*`The Azure subscription ID or name. This can be either the GUID identifier or the display name of the Azure subscription to use.

  `resource-name`The name of the Application Insights resource.

  `resource-group`The name of the Azure resource group containing the Application Insights resource.

  `resource-id`The resource ID of the Application Insights resource.

  `intent*`Describe what information you're trying to get by using this tool.


### Impact Analysis
**Command:** `azmcp monitor app correlate impact`

  Evaluate the distribution and impact of an issue impacting an application. This tool is useful for understanding how many instances are impacted and what the failure rates are. You can use this to validate how widespread an issue is, or to determine the impact of a specific error code or type of dependency. Example usage: Determine how many instances and the overall failure rate caused by requests with a 500 result code: --table requests --filters resultCode="500" Determine how many instances and the overall failure rate caused by Azure Blob storage 500 errors: --table dependencies --filters type="Azure Blob" resultCode="500" Use this tool for investigating issues with Application Insights resources. Required options: - resource-name: The name of the Application Insights resource. or resource-id: The resource ID of the Application Insights resource. - table: The table to list traces for. Valid values are 'requests', 'dependencies', 'availabilityResults', 'exceptions'. Optional options: - filters: The filters to apply to the trace results. A comma-separated list of 'dimension=value'. Dimension names should be valid Application Insights column names. (e.g. "success='false',resultCode='500'") - resource-group: The name of the Azure resource group containing the Application Insights resource. - start-time: The start time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to 24 hours ago. - end-time: The end time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to now.

  Parameters

  `table*`The table to list traces for. Valid values are 'requests', 'dependencies', 'availabilityResults', 'exceptions'.

  `start-time`The start time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to 24 hours ago.

  `end-time`The end time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to now.

  `filters`The filters to apply to the trace results. A comma-separated list of 'dimension=value'. Dimension names should be valid Application Insights column names. (e.g. "success='false',resultCode='500'")

  `tenant`The Azure Active Directory tenant ID or name. This can be either the GUID identifier or the display name of your Azure AD tenant.

  `auth-method`Authentication method to use. Options: 'credential' (Azure CLI/managed identity), 'key' (access key), or 'connectionString'.

  `retry-delay`Initial delay in seconds between retry attempts. For exponential backoff, this value is used as the base.

  `retry-max-delay`Maximum delay in seconds between retries, regardless of the retry strategy.

  `retry-max-retries`Maximum number of retry attempts for failed operations before giving up.

  `retry-mode`Retry strategy to use. 'fixed' uses consistent delays, 'exponential' increases delay between attempts.

  `retry-network-timeout`Network operation timeout in seconds. Operations taking longer than this will be cancelled.

  `subscription*`The Azure subscription ID or name. This can be either the GUID identifier or the display name of the Azure subscription to use.

  `resource-name`The name of the Application Insights resource.

  `resource-group`The name of the Azure resource group containing the Application Insights resource.

  `resource-id`The resource ID of the Application Insights resource.

  `intent*`Describe what information you're trying to get by using this tool.


### Distributed Trace Retrieval
**Command:** `azmcp monitor app correlate trace get`

  Retrieve the distributed trace for an application based on the TraceId and SpanId. This tool is useful for identifying the root cause of problems in an application. and can be used to retrieve the errors, dependency calls and other information about a specific transaction. Use this tool for investigating issues with Application Insights resources. Required options: - resource-name: The name of the Application Insights resource. or resource-id: The resource ID of the Application Insights resource. - trace-id: The specific trace ID to analyze. Optional options: - span-id: The specific span ID in the trace to analyze. - resource-group: The name of the Azure resource group containing the Application Insights resource. - start-time: The start time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to 24 hours ago. - end-time: The end time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to now.

  Parameters

  `trace-id*`The specific trace ID to analyze.

  `start-time`The start time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to 24 hours ago.

  `end-time`The end time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to now.

  `span-id`The specific span ID in the trace to analyze.

  `tenant`The Azure Active Directory tenant ID or name. This can be either the GUID identifier or the display name of your Azure AD tenant.

  `auth-method`Authentication method to use. Options: 'credential' (Azure CLI/managed identity), 'key' (access key), or 'connectionString'.

  `retry-delay`Initial delay in seconds between retry attempts. For exponential backoff, this value is used as the base.

  `retry-max-delay`Maximum delay in seconds between retries, regardless of the retry strategy.

  `retry-max-retries`Maximum number of retry attempts for failed operations before giving up.

  `retry-mode`Retry strategy to use. 'fixed' uses consistent delays, 'exponential' increases delay between attempts.

  `retry-network-timeout`Network operation timeout in seconds. Operations taking longer than this will be cancelled.

  `subscription*`The Azure subscription ID or name. This can be either the GUID identifier or the display name of the Azure subscription to use.

  `resource-name`The name of the Application Insights resource.

  `resource-group`The name of the Azure resource group containing the Application Insights resource.

  `resource-id`The resource ID of the Application Insights resource.

  `intent*`Describe what information you're trying to get by using this tool.


### List Relevant Traces
**Command:** `azmcp monitor app correlate trace list`

  List the most relevant traces from an Application Insights table. This tool is useful for correlating errors and dependencies to specific transactions in an application. Returns a list of traceIds and spanIds that can be further explored for each operation. Example usage: Filter to dependency failures --table=dependencies --filters="success='false'" Filter to request failures with 500 code --table=requests --filters="success='false',resultCode='500'" Filter to requests slower than 95th percentile (use start and end time filters to filter to the duration spike). Any percentile is valid (e.g. 99p is also valid) --table=requests --filters="duration=95p" --start-time="start of spike (ISO date)" --end-time="end of spike (ISO date)" Use this tool for investigating issues with Application Insights resources. Required options: - resource-name: The name of the Application Insights resource. or resource-id: The resource ID of the Application Insights resource. - table: The table to list traces for. Valid values are 'requests', 'dependencies', 'availabilityResults', 'exceptions'. Optional options: - filters: The filters to apply to the trace results. A comma-separated list of 'dimension=value'. Dimension names should be valid Application Insights column names. (e.g. "success='false',resultCode='500'") - resource-group: The name of the Azure resource group containing the Application Insights resource. - start-time: The start time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to 24 hours ago. - end-time: The end time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to now.

  Parameters

  `table*`The table to list traces for. Valid values are 'requests', 'dependencies', 'availabilityResults', 'exceptions'.

  `start-time`The start time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to 24 hours ago.

  `end-time`The end time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to now.

  `filters`The filters to apply to the trace results. A comma-separated list of 'dimension=value'. Dimension names should be valid Application Insights column names. (e.g. "success='false',resultCode='500'")

  `tenant`The Azure Active Directory tenant ID or name. This can be either the GUID identifier or the display name of your Azure AD tenant.

  `auth-method`Authentication method to use. Options: 'credential' (Azure CLI/managed identity), 'key' (access key), or 'connectionString'.

  `retry-delay`Initial delay in seconds between retry attempts. For exponential backoff, this value is used as the base.

  `retry-max-delay`Maximum delay in seconds between retries, regardless of the retry strategy.

  `retry-max-retries`Maximum number of retry attempts for failed operations before giving up.

  `retry-mode`Retry strategy to use. 'fixed' uses consistent delays, 'exponential' increases delay between attempts.

  `retry-network-timeout`Network operation timeout in seconds. Operations taking longer than this will be cancelled.

  `subscription*`The Azure subscription ID or name. This can be either the GUID identifier or the display name of the Azure subscription to use.

  `resource-name`The name of the Application Insights resource.

  `resource-group`The name of the Azure resource group containing the Application Insights resource.

  `resource-id`The resource ID of the Application Insights resource.

  `intent*`Describe what information you're trying to get by using this tool.


### Retrieve a span from distributed trace
**Command:** `azmcp monitor app correlate trace get-span`

  Retrieve a single span with full details from a distributed trace based on the ItemId. This tool is useful for getting exception stack traces, details about dependency calls and other specific information from a distributed trace. Use this tool for investigating issues with Application Insights resources. Required options: - resource-name: The name of the Application Insights resource. or resource-id: The resource ID of the Application Insights resource. - item-id: The specific ItemId in the distributed trace to retrieve details of. - item-type: The specific ItemType of the item in the distributed trace to retrieve details of. (e.g. 'exception') Optional options: - resource-group: The name of the Azure resource group containing the Application Insights resource. - start-time: The start time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to 24 hours ago. - end-time: The end time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to now.

  Parameters

  `start-time`The start time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to 24 hours ago.

  `end-time`The end time of the investigation in ISO format (e.g., 2023-01-01T00:00:00Z). Defaults to now.

  `item-id*`The specific ItemId in the distributed trace to retrieve details of.

  `item-type*`The specific ItemType of the item in the distributed trace to retrieve details of. (e.g. 'exception')

  `tenant`The Azure Active Directory tenant ID or name. This can be either the GUID identifier or the display name of your Azure AD tenant.

  `auth-method`Authentication method to use. Options: 'credential' (Azure CLI/managed identity), 'key' (access key), or 'connectionString'.

  `retry-delay`Initial delay in seconds between retry attempts. For exponential backoff, this value is used as the base.

  `retry-max-delay`Maximum delay in seconds between retries, regardless of the retry strategy.

  `retry-max-retries`Maximum number of retry attempts for failed operations before giving up.

  `retry-mode`Retry strategy to use. 'fixed' uses consistent delays, 'exponential' increases delay between attempts.

  `retry-network-timeout`Network operation timeout in seconds. Operations taking longer than this will be cancelled.

  `subscription*`The Azure subscription ID or name. This can be either the GUID identifier or the display name of the Azure subscription to use.

  `resource-name`The name of the Application Insights resource.

  `resource-group`The name of the Azure resource group containing the Application Insights resource.

  `resource-id`The resource ID of the Application Insights resource.

  `intent*`Describe what information you're trying to get by using this tool.
