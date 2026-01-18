"""
Email template generator for different notification types
"""
from datetime import datetime

def get_user_name(user_data):
    """Extract user name from user data, handling nested structure"""
    # Handle nested 'user' object
    user_info = user_data.get('user', user_data) if isinstance(user_data, dict) else user_data
    # Try 'name' first (our user model), then 'first_name' as fallback
    name = user_info.get('name') or user_info.get('first_name') or 'Stimat Client'
    # If name contains space, get first name only
    if name and ' ' in name:
        name = name.split()[0]
    return name

class EmailTemplates:
    """Email template generator for order notifications"""
    
    @staticmethod
    def order_confirmed_template(order_data, user_data, flowers_map=None):
        """Generate HTML template for order confirmation email"""
        subject = f"Comandă Confirmată - BloomFlow #{order_data['id']}"
        user_name = get_user_name(user_data)
        flowers_map = flowers_map or {}
        
        items_html = ""
        for item in order_data.get('items', []):
            flower_id = item['flower_type_id']
            flower_name = flowers_map.get(flower_id, f"Floare #{flower_id}")
            items_html += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                    {flower_name}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                    {item['quantity']}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                    {item['unit_price']:.2f} RON
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">
                    {item['subtotal']:.2f} RON
                </td>
            </tr>
            """
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 5px; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 28px; }}
                .content {{ padding: 20px; background: #f9f9f9; border-radius: 5px; margin: 20px 0; }}
                .order-details {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
                .order-details th {{ background: #667eea; color: white; padding: 12px; text-align: left; }}
                .order-details td {{ padding: 10px; border-bottom: 1px solid #ddd; }}
                .total {{ font-weight: bold; font-size: 18px; color: #764ba2; }}
                .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }}
                .button {{ display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Comandă Confirmată!</h1>
                </div>
                
                <div class="content">
                    <p>Bună <strong>{user_name}</strong>,</p>
                    
                    <p>Comandă dvs. a fost <strong>confirmată</strong> și va fi procesată în curând.</p>
                    
                    <h3>Detalii Comandă #{ order_data['id']}</h3>
                    <table class="order-details">
                        <thead>
                            <tr>
                                <th>Produs</th>
                                <th>Cantitate</th>
                                <th>Preț Unitar</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                            <tr>
                                <td colspan="3" style="text-align: right; padding: 15px 10px;">
                                    <strong>Total:</strong>
                                </td>
                                <td style="padding: 15px 10px;" class="total">
                                    {order_data['total_price']:.2f} RON
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <p><strong>Status Comandă:</strong> {order_data['status'].upper()}</p>
                    <p><strong>Data Comandă:</strong> {order_data['created_at']}</p>
                    
                    <p>Vă mulțumim pentru comanda dvs. Echipa BloomFlow va procesa comanda în cel mai scurt timp.</p>
                </div>
                
                <div class="footer">
                    <p>© 2026 BloomFlow - Platforma de Gestionare a Florăriei</p>
                    <p>Pentru informații suplimentare, contactați-ne la support@bloomflow.com</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return subject, html
    
    @staticmethod
    def order_paid_template(order_data, user_data, flowers_map=None):
        """Generate HTML template for payment confirmation email"""
        subject = f"Plată Confirmată - BloomFlow #{order_data['id']}"
        user_name = get_user_name(user_data)
        # flowers_map not used in this template but accepted for consistency
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 5px; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 28px; }}
                .content {{ padding: 20px; background: #f9f9f9; border-radius: 5px; margin: 20px 0; }}
                .success-badge {{ display: inline-block; background: #4caf50; color: white; padding: 10px 20px; border-radius: 5px; margin: 10px 0; }}
                .details {{ margin: 20px 0; padding: 15px; background: white; border-left: 4px solid #4caf50; }}
                .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Plată Primită!</h1>
                </div>
                
                <div class="content">
                    <p>Bună <strong>{user_name}</strong>,</p>
                    
                    <div class="success-badge">✓ Plată Confirmată</div>
                    
                    <p>Mulțumim! Plata pentru comandă a fost <strong>primită cu succes</strong>.</p>
                    
                    <div class="details">
                        <p><strong>Numărul Comandă:</strong> #{order_data['id']}</p>
                        <p><strong>Valoare:</strong> {order_data['total_price']:.2f} RON</p>
                        <p><strong>Status Plată:</strong> <span style="color: #4caf50; font-weight: bold;">{order_data['payment_status'].upper()}</span></p>
                        <p><strong>Data Plății:</strong> {datetime.utcnow().strftime('%d.%m.%Y %H:%M')}</p>
                    </div>
                    
                    <p>Comanda dvs. va fi procesată și pregătită pentru expediere în cel mai scurt timp.</p>
                    <p>Vă vom notifica prin email cu alte actualizări despre progresul comenzii.</p>
                </div>
                
                <div class="footer">
                    <p>© 2026 BloomFlow - Platforma de Gestionare a Florăriei</p>
                    <p>Pentru orice întrebare, contactați-ne la support@bloomflow.com</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return subject, html
    
    @staticmethod
    def order_completed_template(order_data, user_data, flowers_map=None):
        """Generate HTML template for order completion email"""
        subject = f"Comandă Finalizată - BloomFlow #{order_data['id']}"
        user_name = get_user_name(user_data)
        # flowers_map not used in this template but accepted for consistency
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%); color: white; padding: 20px; border-radius: 5px; text-align: center; }}
                .header h1 {{ margin: 0; font-size: 28px; text-shadow: 1px 1px 2px rgba(0,0,0,0.1); }}
                .content {{ padding: 20px; background: #f9f9f9; border-radius: 5px; margin: 20px 0; }}
                .completion-badge {{ display: inline-block; background: #2196F3; color: white; padding: 10px 20px; border-radius: 5px; margin: 10px 0; font-weight: bold; }}
                .details {{ margin: 20px 0; padding: 15px; background: white; border-left: 4px solid #2196F3; }}
                .footer {{ text-align: center; color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Comandă Finalizată!</h1>
                </div>
                
                <div class="content">
                    <p>Bună <strong>{user_name}</strong>,</p>
                    
                    <div class="completion-badge">✓ Comandă Pregătită</div>
                    
                    <p>Comandă dvs. a fost <strong>finalizată și este gata</strong> pentru ridicare sau expediere.</p>
                    
                    <div class="details">
                        <p><strong>Numărul Comandă:</strong> #{order_data['id']}</p>
                        <p><strong>Valoare Totală:</strong> {order_data['total_price']:.2f} RON</p>
                        <p><strong>Status:</strong> <span style="color: #2196F3; font-weight: bold;">{order_data['status'].upper()}</span></p>
                        <p><strong>Data Finalizării:</strong> {datetime.utcnow().strftime('%d.%m.%Y %H:%M')}</p>
                    </div>
                    
                    <p>Flori dvs. au fost pregătite cu grijă de către echipa noastră profesionistă.</p>
                    <p>Vă rugăm să contactați-ne pentru a programa ridicarea sau expedirea.</p>
                </div>
                
                <div class="footer">
                    <p>© 2026 BloomFlow - Platforma de Gestionare a Florăriei</p>
                    <p>Telefon: +40 XXX XXX XXX | Email: support@bloomflow.com</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return subject, html
