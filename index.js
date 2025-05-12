// Customizable Telegram Recurring Post Bot
// Features: User-defined templates, flexible scheduling, web interface

// KV data store for saving user templates and schedules
// In Cloudflare, create a KV namespace called "BOT_TEMPLATES"

export default {
  async scheduled(controller, env, ctx) {
    return await handleSchedule(new Date(), env);
  },
  
  async fetch(request, env, ctx) {
    return await handleRequest(request, env);
  }
};

// Process scheduled events
async function handleSchedule(currentTime, env) {
  try {
    // Get all templates from KV store
    let templatesList = await env.BOT_TEMPLATES.get("all_templates", { type: "json" }) || [];
    
    for (const templateId of templatesList) {
      const template = await env.BOT_TEMPLATES.get(templateId, { type: "json" });
      
      if (!template) continue;
      
      // Check if it's time to send this template
      if (shouldSendNow(template, currentTime)) {
        console.log(`Sending template: ${template.name}`);
        
        // Send the message
        if (template.includeImage && template.imageUrl) {
          await sendTelegramPhoto(template.message, template.imageUrl, env);
        } else {
          await sendTelegramMessage(template.message, env);
        }
        
        // Update last sent time
        template.lastSentTime = currentTime.getTime();
        await env.BOT_TEMPLATES.put(templateId, JSON.stringify(template));
      }
    }
    
    return new Response("Scheduled task completed", { status: 200 });
  } catch (error) {
    console.error("Error in scheduled function:", error);
    return new Response("Error in scheduled function: " + error.message, { status: 500 });
  }
}

// Check if a template should be sent now based on its schedule
function shouldSendNow(template, currentTime) {
  if (!template.lastSentTime) {
    // First run, should send
    return true;
  }
  
  const lastSent = new Date(template.lastSentTime);
  const elapsedMs = currentTime.getTime() - lastSent.getTime();
  
  // Calculate interval in milliseconds
  let intervalMs;
  if (template.intervalUnit === "minutes") {
    intervalMs = template.intervalValue * 60 * 1000;
  } else if (template.intervalUnit === "hours") {
    intervalMs = template.intervalValue * 60 * 60 * 1000;
  } else if (template.intervalUnit === "days") {
    intervalMs = template.intervalValue * 24 * 60 * 60 * 1000;
  } else {
    // Default to daily
    intervalMs = 24 * 60 * 60 * 1000;
  }
  
  return elapsedMs >= intervalMs;
}

// Send a text message to Telegram
async function sendTelegramMessage(text, env) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: env.CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    }),
  });
  
  return response.json();
}

// Send a photo with caption to Telegram
async function sendTelegramPhoto(caption, photoUrl, env) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: env.CHAT_ID,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'HTML'
    }),
  });
  
  return response.json();
}

// Handle HTTP requests for the web interface and API
async function handleRequest(request, env) {
  const url = new URL(request.url);
  
  // Serve a simple HTML interface for managing templates
  if (url.pathname === "/" && request.method === "GET") {
    return new Response(generateHtmlInterface(), {
      headers: { "Content-Type": "text/html" }
    });
  }
  
  // API endpoint to list all templates
  if (url.pathname === "/api/templates" && request.method === "GET") {
    try {
      const templatesList = await env.BOT_TEMPLATES.get("all_templates", { type: "json" }) || [];
      const templates = [];
      
      for (const id of templatesList) {
        const template = await env.BOT_TEMPLATES.get(id, { type: "json" });
        if (template) templates.push(template);
      }
      
      return new Response(JSON.stringify(templates), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  // API endpoint to create a new template
  if (url.pathname === "/api/templates" && request.method === "POST") {
    try {
      const formData = await request.formData();
      
      const template = {
        id: "template_" + Date.now(),
        name: formData.get("name") || "Unnamed Template",
        message: formData.get("message") || "No message content",
        intervalValue: parseInt(formData.get("intervalValue") || "24", 10),
        intervalUnit: formData.get("intervalUnit") || "hours",
        includeImage: formData.get("includeImage") === "true",
        imageUrl: formData.get("imageUrl") || "",
        createdAt: Date.now()
      };
      
      // Get existing template list
      let templatesList = await env.BOT_TEMPLATES.get("all_templates", { type: "json" }) || [];
      templatesList.push(template.id);
      
      // Save template and update list
      await env.BOT_TEMPLATES.put(template.id, JSON.stringify(template));
      await env.BOT_TEMPLATES.put("all_templates", JSON.stringify(templatesList));
      
      // Redirect back to homepage
      return new Response("Template created", {
        status: 302,
        headers: { "Location": "/" }
      });
    } catch (error) {
      return new Response("Error creating template: " + error.message, { status: 500 });
    }
  }
  
  // API endpoint to delete a template
  if (url.pathname.startsWith("/api/templates/") && request.method === "DELETE") {
    try {
      const id = url.pathname.split("/").pop();
      
      // Get existing template list
      let templatesList = await env.BOT_TEMPLATES.get("all_templates", { type: "json" }) || [];
      templatesList = templatesList.filter(templateId => templateId !== id);
      
      // Delete template and update list
      await env.BOT_TEMPLATES.delete(id);
      await env.BOT_TEMPLATES.put("all_templates", JSON.stringify(templatesList));
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  // API endpoint to trigger a template immediately
  if (url.pathname.startsWith("/api/send/") && request.method === "POST") {
    try {
      const id = url.pathname.split("/").pop();
      const template = await env.BOT_TEMPLATES.get(id, { type: "json" });
      
      if (!template) {
        return new Response(JSON.stringify({ error: "Template not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Send the message
      let result;
      if (template.includeImage && template.imageUrl) {
        result = await sendTelegramPhoto(template.message, template.imageUrl, env);
      } else {
        result = await sendTelegramMessage(template.message, env);
      }
      
      // Update last sent time
      template.lastSentTime = Date.now();
      await env.BOT_TEMPLATES.put(id, JSON.stringify(template));
      
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  // Default response
  return new Response("Not found", { status: 404 });
}

// Generate HTML interface for managing templates
function generateHtmlInterface() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Telegram Recurring Post Bot</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    .container { max-width: 900px; }
    .template-card { margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container py-4">
    <h1 class="mb-4">Telegram Recurring Post Bot</h1>
    
    <div class="row">
      <div class="col-md-8">
        <h2>Your Templates</h2>
        <div id="templates-container" class="mb-4">
          <div class="d-flex justify-content-center">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="col-md-4">
        <div class="card">
          <div class="card-header">
            Create New Template
          </div>
          <div class="card-body">
            <form id="new-template-form" action="/api/templates" method="post">
              <div class="mb-3">
                <label for="name" class="form-label">Template Name</label>
                <input type="text" class="form-control" id="name" name="name" required>
              </div>
              
              <div class="mb-3">
                <label for="message" class="form-label">Message Content</label>
                <textarea class="form-control" id="message" name="message" rows="4" required></textarea>
              </div>
              
              <div class="row mb-3">
                <div class="col-6">
                  <label for="intervalValue" class="form-label">Repeat Every</label>
                  <input type="number" class="form-control" id="intervalValue" name="intervalValue" min="1" value="24" required>
                </div>
                <div class="col-6">
                  <label for="intervalUnit" class="form-label">Unit</label>
                  <select class="form-select" id="intervalUnit" name="intervalUnit">
                    <option value="minutes">Minutes</option>
                    <option value="hours" selected>Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
              
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="includeImage" name="includeImage" value="true">
                <label class="form-check-label" for="includeImage">Include Image</label>
              </div>
              
              <div class="mb-3" id="imageUrlField" style="display: none;">
                <label for="imageUrl" class="form-label">Image URL</label>
                <input type="url" class="form-control" id="imageUrl" name="imageUrl">
              </div>
              
              <button type="submit" class="btn btn-primary">Create Template</button>
            </form>
          </div>
        </div>
      </div>
    </div>
    
  </div>
  
  <script>
    // Toggle image URL field
    document.getElementById('includeImage').addEventListener('change', function() {
      document.getElementById('imageUrlField').style.display = this.checked ? 'block' : 'none';
    });
    
    // Fetch and display templates
    async function loadTemplates() {
      try {
        const response = await fetch('/api/templates');
        const templates = await response.json();
        
        const container = document.getElementById('templates-container');
        
        if (templates.length === 0) {
          container.innerHTML = '<div class="alert alert-info">No templates yet. Create your first one!</div>';
          return;
        }
        
        const templateCards = templates.map(template => {
          let lastSentText = template.lastSentTime ? 
                            new Date(template.lastSentTime).toLocaleString() : 
                            'Never sent';
                            
          return \`
            <div class="card template-card">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="m-0">\${template.name}</h5>
                <div>
                  <button onclick="sendNow('\${template.id}')" class="btn btn-sm btn-primary">Send Now</button>
                  <button onclick="deleteTemplate('\${template.id}')" class="btn btn-sm btn-danger">Delete</button>
                </div>
              </div>
              <div class="card-body">
                <p class="card-text">\${template.message}</p>
                <p class="text-muted">Repeats every \${template.intervalValue} \${template.intervalUnit}</p>
                <p class="text-muted">Last sent: \${lastSentText}</p>
                \${template.includeImage ? \`<p class="text-muted">Includes image: \${template.imageUrl}</p>\` : ''}
              </div>
            </div>
          \`;
        }).join('');
        
        container.innerHTML = templateCards;
      } catch (error) {
        console.error("Error loading templates:", error);
        document.getElementById('templates-container').innerHTML = 
          '<div class="alert alert-danger">Error loading templates</div>';
      }
    }
    
    // Send a template now
    async function sendNow(id) {
      try {
        const response = await fetch(\`/api/send/\${id}\`, { method: 'POST' });
        const result = await response.json();
        
        if (result.ok) {
          alert('Message sent successfully!');
        } else {
          alert('Error: ' + (result.description || 'Unknown error'));
        }
        
        // Reload templates to update last sent time
        loadTemplates();
      } catch (error) {
        console.error("Error sending template:", error);
        alert('Error sending template');
      }
    }
    
    // Delete a template
    async function deleteTemplate(id) {
      if (!confirm('Are you sure you want to delete this template?')) return;
      
      try {
        const response = await fetch(\`/api/templates/\${id}\`, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.success) {
          loadTemplates();
        } else {
          alert('Error: ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        console.error("Error deleting template:", error);
        alert('Error deleting template');
      }
    }
    
    // Load templates on page load
    document.addEventListener('DOMContentLoaded', loadTemplates);
  </script>
</body>
</html>
  `;
}
