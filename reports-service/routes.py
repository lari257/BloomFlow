"""
Reports API Routes
All queries run on PostgreSQL read replica
"""
from flask import Blueprint, request, jsonify, Response
from datetime import datetime, timedelta
import requests
import io
from config import Config
from database import execute_query, get_orders_connection, get_inventory_connection

bp = Blueprint('reports', __name__)

def verify_token():
    """Verify token with auth service"""
    token = request.headers.get('Authorization')
    if not token:
        return None
    
    try:
        response = requests.post(
            f"{Config.AUTH_SERVICE_URL}/verify",
            json={'token': token},
            headers={'Authorization': token},
            timeout=5
        )
        if response.status_code == 200:
            return response.json().get('user')
    except Exception as e:
        print(f"Error verifying token: {e}")
    
    return None

def require_auth(f):
    """Decorator to require authentication"""
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_info = verify_token()
        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401
        request.current_user = user_info
        return f(*args, **kwargs)
    return decorated_function

def get_roles_from_token(user_info):
    """Extract roles from token"""
    if 'roles' in user_info:
        return user_info.get('roles', [])
    realm_access = user_info.get('realm_access', {})
    return realm_access.get('roles', [])

def require_role(*allowed_roles):
    """Decorator to require specific role(s)"""
    from functools import wraps
    
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            user_info = request.current_user
            token_roles = get_roles_from_token(user_info)
            
            if not any(role in token_roles for role in allowed_roles):
                return jsonify({
                    'error': 'Insufficient permissions',
                    'required_roles': list(allowed_roles),
                    'your_roles': token_roles
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ============================================================
# SALES REPORTS
# ============================================================

@bp.route('/reports/sales/summary', methods=['GET'])
@require_role('admin', 'florar')
def get_sales_summary():
    """
    Get sales summary report
    Query params: start_date, end_date (YYYY-MM-DD format)
    Runs on READ REPLICA
    """
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')
    
    query = """
        SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(total_price), 0) as total_revenue,
            COALESCE(AVG(total_price), 0) as average_order_value,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
            COUNT(CASE WHEN payment_status = 'succeeded' THEN 1 END) as paid_orders
        FROM orders
        WHERE created_at >= :start_date AND created_at <= :end_date
    """
    
    results = execute_query(get_orders_connection, query, {
        'start_date': start_date,
        'end_date': end_date + ' 23:59:59'
    })
    
    summary = results[0] if results else {
        'total_orders': 0,
        'total_revenue': 0,
        'average_order_value': 0,
        'completed_orders': 0,
        'cancelled_orders': 0,
        'paid_orders': 0
    }
    
    # Convert Decimal to float for JSON serialization
    for key in summary:
        if summary[key] is not None and hasattr(summary[key], '__float__'):
            summary[key] = float(summary[key])
    
    return jsonify({
        'report': 'sales_summary',
        'period': {'start_date': start_date, 'end_date': end_date},
        'data': summary,
        'source': 'read-replica'
    }), 200


@bp.route('/reports/sales/daily', methods=['GET'])
@require_role('admin', 'florar')
def get_daily_sales():
    """
    Get daily sales breakdown
    Runs on READ REPLICA
    """
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')
    
    query = """
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as order_count,
            COALESCE(SUM(total_price), 0) as revenue
        FROM orders
        WHERE created_at >= :start_date AND created_at <= :end_date
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    """
    
    results = execute_query(get_orders_connection, query, {
        'start_date': start_date,
        'end_date': end_date + ' 23:59:59'
    })
    
    # Convert for JSON
    for row in results:
        if row.get('date'):
            row['date'] = row['date'].isoformat() if hasattr(row['date'], 'isoformat') else str(row['date'])
        if row.get('revenue') and hasattr(row['revenue'], '__float__'):
            row['revenue'] = float(row['revenue'])
    
    return jsonify({
        'report': 'daily_sales',
        'period': {'start_date': start_date, 'end_date': end_date},
        'data': results,
        'source': 'read-replica'
    }), 200


# ============================================================
# INVENTORY REPORTS
# ============================================================

@bp.route('/reports/inventory/levels', methods=['GET'])
@require_role('admin', 'florar')
def get_inventory_levels():
    """
    Get current inventory levels
    Runs on READ REPLICA
    """
    query = """
        SELECT 
            ft.id,
            ft.name,
            ft.color,
            ft.price_per_unit,
            COALESCE(SUM(CASE WHEN fl.status = 'available' AND fl.expiry_date >= CURRENT_DATE THEN fl.quantity ELSE 0 END), 0) as available_stock,
            COALESCE(SUM(CASE WHEN fl.status = 'reserved' THEN fl.quantity ELSE 0 END), 0) as reserved_stock,
            COUNT(DISTINCT fl.id) as lot_count
        FROM flower_types ft
        LEFT JOIN flower_lots fl ON ft.id = fl.flower_type_id
        GROUP BY ft.id, ft.name, ft.color, ft.price_per_unit
        ORDER BY ft.name
    """
    
    results = execute_query(get_inventory_connection, query)
    
    # Convert for JSON
    for row in results:
        if row.get('price_per_unit') and hasattr(row['price_per_unit'], '__float__'):
            row['price_per_unit'] = float(row['price_per_unit'])
    
    return jsonify({
        'report': 'inventory_levels',
        'data': results,
        'source': 'read-replica'
    }), 200


@bp.route('/reports/inventory/low-stock', methods=['GET'])
@require_role('admin', 'florar')
def get_low_stock():
    """
    Get flowers with low stock (below threshold)
    Runs on READ REPLICA
    """
    threshold = request.args.get('threshold', 10, type=int)
    
    query = """
        SELECT 
            ft.id,
            ft.name,
            ft.color,
            ft.price_per_unit,
            COALESCE(SUM(CASE WHEN fl.status = 'available' AND fl.expiry_date >= CURRENT_DATE THEN fl.quantity ELSE 0 END), 0) as available_stock
        FROM flower_types ft
        LEFT JOIN flower_lots fl ON ft.id = fl.flower_type_id
        GROUP BY ft.id, ft.name, ft.color, ft.price_per_unit
        HAVING COALESCE(SUM(CASE WHEN fl.status = 'available' AND fl.expiry_date >= CURRENT_DATE THEN fl.quantity ELSE 0 END), 0) < :threshold
        ORDER BY available_stock ASC
    """
    
    results = execute_query(get_inventory_connection, query, {'threshold': threshold})
    
    # Convert for JSON
    for row in results:
        if row.get('price_per_unit') and hasattr(row['price_per_unit'], '__float__'):
            row['price_per_unit'] = float(row['price_per_unit'])
    
    return jsonify({
        'report': 'low_stock',
        'threshold': threshold,
        'data': results,
        'source': 'read-replica'
    }), 200


@bp.route('/reports/inventory/expiring', methods=['GET'])
@require_role('admin', 'florar')
def get_expiring_stock():
    """
    Get lots expiring within specified days
    Runs on READ REPLICA
    """
    days = request.args.get('days', 7, type=int)
    
    query = """
        SELECT 
            fl.id as lot_id,
            ft.name as flower_name,
            ft.color,
            fl.quantity,
            fl.expiry_date,
            fl.purchase_price,
            fl.status
        FROM flower_lots fl
        JOIN flower_types ft ON fl.flower_type_id = ft.id
        WHERE fl.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + :days
          AND fl.status = 'available'
          AND fl.quantity > 0
        ORDER BY fl.expiry_date ASC
    """
    
    results = execute_query(get_inventory_connection, query, {'days': days})
    
    # Convert for JSON
    for row in results:
        if row.get('expiry_date'):
            row['expiry_date'] = row['expiry_date'].isoformat() if hasattr(row['expiry_date'], 'isoformat') else str(row['expiry_date'])
        if row.get('purchase_price') and hasattr(row['purchase_price'], '__float__'):
            row['purchase_price'] = float(row['purchase_price'])
    
    return jsonify({
        'report': 'expiring_stock',
        'days': days,
        'data': results,
        'source': 'read-replica'
    }), 200


# ============================================================
# ORDER REPORTS
# ============================================================

@bp.route('/reports/orders/status', methods=['GET'])
@require_role('admin', 'florar')
def get_orders_by_status():
    """
    Get orders grouped by status
    Runs on READ REPLICA
    """
    query = """
        SELECT 
            status,
            COUNT(*) as count,
            COALESCE(SUM(total_price), 0) as total_value
        FROM orders
        GROUP BY status
        ORDER BY count DESC
    """
    
    results = execute_query(get_orders_connection, query)
    
    # Convert for JSON
    for row in results:
        if row.get('total_value') and hasattr(row['total_value'], '__float__'):
            row['total_value'] = float(row['total_value'])
    
    return jsonify({
        'report': 'orders_by_status',
        'data': results,
        'source': 'read-replica'
    }), 200


@bp.route('/reports/orders/top-products', methods=['GET'])
@require_role('admin', 'florar')
def get_top_products():
    """
    Get top selling products
    Runs on READ REPLICA
    """
    limit = request.args.get('limit', 10, type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')
    
    query = """
        SELECT 
            oi.flower_type_id,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.subtotal) as total_revenue,
            COUNT(DISTINCT o.id) as order_count
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= :start_date AND o.created_at <= :end_date
        GROUP BY oi.flower_type_id
        ORDER BY total_quantity DESC
        LIMIT :limit
    """
    
    results = execute_query(get_orders_connection, query, {
        'start_date': start_date,
        'end_date': end_date + ' 23:59:59',
        'limit': limit
    })
    
    # Try to get flower names from inventory database
    if results:
        flower_ids = [r['flower_type_id'] for r in results]
        flower_query = """
            SELECT id, name, color FROM flower_types WHERE id = ANY(:ids)
        """
        # PostgreSQL needs array format
        flower_query_simple = f"""
            SELECT id, name, color FROM flower_types WHERE id IN ({','.join(map(str, flower_ids))})
        """
        flowers = execute_query(get_inventory_connection, flower_query_simple)
        flower_map = {f['id']: f for f in flowers}
        
        for row in results:
            flower_info = flower_map.get(row['flower_type_id'], {})
            row['flower_name'] = flower_info.get('name', f"Flower #{row['flower_type_id']}")
            row['flower_color'] = flower_info.get('color')
            if row.get('total_revenue') and hasattr(row['total_revenue'], '__float__'):
                row['total_revenue'] = float(row['total_revenue'])
    
    return jsonify({
        'report': 'top_products',
        'period': {'start_date': start_date, 'end_date': end_date},
        'data': results,
        'source': 'read-replica'
    }), 200


@bp.route('/reports/orders/payment-status', methods=['GET'])
@require_role('admin', 'florar')
def get_payment_status_report():
    """
    Get orders grouped by payment status
    Runs on READ REPLICA
    """
    query = """
        SELECT 
            payment_status,
            COUNT(*) as count,
            COALESCE(SUM(total_price), 0) as total_value
        FROM orders
        GROUP BY payment_status
        ORDER BY count DESC
    """
    
    results = execute_query(get_orders_connection, query)
    
    # Convert for JSON
    for row in results:
        if row.get('total_value') and hasattr(row['total_value'], '__float__'):
            row['total_value'] = float(row['total_value'])
    
    return jsonify({
        'report': 'payment_status',
        'data': results,
        'source': 'read-replica'
    }), 200


# ============================================================
# COMBINED DASHBOARD REPORT
# ============================================================

@bp.route('/reports/dashboard', methods=['GET'])
@require_role('admin', 'florar')
def get_dashboard_report():
    """
    Get combined dashboard report with key metrics
    Runs on READ REPLICA
    """
    # Get sales summary for last 30 days
    sales_query = """
        SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(total_price), 0) as total_revenue,
            COALESCE(AVG(total_price), 0) as average_order_value
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    """
    sales = execute_query(get_orders_connection, sales_query)
    sales_data = sales[0] if sales else {}
    
    # Get orders by status
    status_query = """
        SELECT status, COUNT(*) as count
        FROM orders
        GROUP BY status
    """
    status_data = execute_query(get_orders_connection, status_query)
    
    # Get low stock count
    low_stock_query = """
        SELECT COUNT(*) as count
        FROM (
            SELECT ft.id
            FROM flower_types ft
            LEFT JOIN flower_lots fl ON ft.id = fl.flower_type_id
            GROUP BY ft.id
            HAVING COALESCE(SUM(CASE WHEN fl.status = 'available' AND fl.expiry_date >= CURRENT_DATE THEN fl.quantity ELSE 0 END), 0) < 10
        ) low_stock
    """
    low_stock = execute_query(get_inventory_connection, low_stock_query)
    low_stock_count = low_stock[0]['count'] if low_stock else 0
    
    # Get expiring soon count
    expiring_query = """
        SELECT COUNT(*) as count
        FROM flower_lots
        WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
          AND status = 'available'
          AND quantity > 0
    """
    expiring = execute_query(get_inventory_connection, expiring_query)
    expiring_count = expiring[0]['count'] if expiring else 0
    
    # Convert Decimals
    for key in sales_data:
        if sales_data[key] is not None and hasattr(sales_data[key], '__float__'):
            sales_data[key] = float(sales_data[key])
    
    return jsonify({
        'report': 'dashboard',
        'data': {
            'sales_last_30_days': sales_data,
            'orders_by_status': status_data,
            'low_stock_items': low_stock_count,
            'expiring_soon_lots': expiring_count
        },
        'source': 'read-replica'
    }), 200


# ============================================================
# PDF EXPORT
# ============================================================

def generate_pdf_report(report_type, data, period=None):
    """Generate PDF report using ReportLab"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*cm, bottomMargin=1*cm)
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#E91E63')
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#666666')
    )
    
    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontSize=16,
        spaceBefore=20,
        spaceAfter=10,
        textColor=colors.HexColor('#9C27B0')
    )
    
    # Header
    elements.append(Paragraph("🌸 BloomFlow Reports", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", subtitle_style))
    
    if period:
        elements.append(Paragraph(f"Period: {period.get('start_date', '')} - {period.get('end_date', '')}", subtitle_style))
    
    elements.append(Spacer(1, 20))
    
    # Table style
    table_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E91E63')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#FFF0F5')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E91E63')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FFF0F5')]),
    ])
    
    if report_type == 'dashboard':
        # Sales Summary
        sales = data.get('sales_last_30_days', {})
        elements.append(Paragraph("📈 Sales Summary (Last 30 Days)", section_style))
        
        sales_data = [
            ['Metric', 'Value'],
            ['Total Orders', str(sales.get('total_orders', 0))],
            ['Total Revenue', f"${sales.get('total_revenue', 0):.2f}"],
            ['Average Order Value', f"${sales.get('average_order_value', 0):.2f}"],
        ]
        t = Table(sales_data, colWidths=[200, 200])
        t.setStyle(table_style)
        elements.append(t)
        elements.append(Spacer(1, 20))
        
        # Orders by Status
        elements.append(Paragraph("📦 Orders by Status", section_style))
        orders_status = data.get('orders_by_status', [])
        if orders_status:
            status_data = [['Status', 'Count']]
            for item in orders_status:
                status_data.append([item.get('status', ''), str(item.get('count', 0))])
            t = Table(status_data, colWidths=[200, 200])
            t.setStyle(table_style)
            elements.append(t)
        else:
            elements.append(Paragraph("No orders data available", styles['Normal']))
        elements.append(Spacer(1, 20))
        
        # Alerts
        elements.append(Paragraph("⚠️ Alerts", section_style))
        alerts_data = [
            ['Alert Type', 'Count'],
            ['Low Stock Items', str(data.get('low_stock_items', 0))],
            ['Expiring Soon (7 days)', str(data.get('expiring_soon_lots', 0))],
        ]
        t = Table(alerts_data, colWidths=[200, 200])
        t.setStyle(table_style)
        elements.append(t)
    
    elif report_type == 'sales':
        elements.append(Paragraph("📈 Sales Report", section_style))
        
        summary = data.get('summary', {})
        if summary:
            summary_data = [
                ['Metric', 'Value'],
                ['Total Orders', str(summary.get('total_orders', 0))],
                ['Total Revenue', f"${summary.get('total_revenue', 0):.2f}"],
                ['Average Order Value', f"${summary.get('average_order_value', 0):.2f}"],
                ['Completed Orders', str(summary.get('completed_orders', 0))],
                ['Cancelled Orders', str(summary.get('cancelled_orders', 0))],
            ]
            t = Table(summary_data, colWidths=[200, 200])
            t.setStyle(table_style)
            elements.append(t)
        elements.append(Spacer(1, 20))
        
        # Daily sales
        daily = data.get('daily', [])
        if daily:
            elements.append(Paragraph("📅 Daily Sales", section_style))
            daily_data = [['Date', 'Orders', 'Revenue']]
            for item in daily[:30]:  # Limit to 30 days
                daily_data.append([
                    str(item.get('date', '')),
                    str(item.get('order_count', 0)),
                    f"${item.get('revenue', 0):.2f}"
                ])
            t = Table(daily_data, colWidths=[150, 100, 150])
            t.setStyle(table_style)
            elements.append(t)
    
    elif report_type == 'inventory':
        elements.append(Paragraph("📦 Inventory Report", section_style))
        
        levels = data.get('levels', [])
        if levels:
            elements.append(Paragraph("Stock Levels", section_style))
            inv_data = [['Flower', 'Color', 'Price', 'Available', 'Lots']]
            for item in levels:
                inv_data.append([
                    item.get('name', ''),
                    item.get('color', '-'),
                    f"${item.get('price_per_unit', 0):.2f}",
                    str(item.get('available_stock', 0)),
                    str(item.get('lot_count', 0))
                ])
            t = Table(inv_data, colWidths=[120, 80, 80, 80, 60])
            t.setStyle(table_style)
            elements.append(t)
        elements.append(Spacer(1, 20))
        
        # Low stock
        low_stock = data.get('low_stock', [])
        if low_stock:
            elements.append(Paragraph("⚠️ Low Stock Alert", section_style))
            low_data = [['Flower', 'Color', 'Available Stock']]
            for item in low_stock:
                low_data.append([
                    item.get('name', ''),
                    item.get('color', '-'),
                    str(item.get('available_stock', 0))
                ])
            t = Table(low_data, colWidths=[150, 100, 150])
            t.setStyle(table_style)
            elements.append(t)
        elements.append(Spacer(1, 20))
        
        # Expiring
        expiring = data.get('expiring', [])
        if expiring:
            elements.append(Paragraph("⏰ Expiring Soon", section_style))
            exp_data = [['Flower', 'Quantity', 'Expiry Date']]
            for item in expiring:
                exp_data.append([
                    item.get('flower_name', ''),
                    str(item.get('quantity', 0)),
                    str(item.get('expiry_date', ''))
                ])
            t = Table(exp_data, colWidths=[150, 100, 150])
            t.setStyle(table_style)
            elements.append(t)
    
    elif report_type == 'orders':
        elements.append(Paragraph("📋 Orders Report", section_style))
        
        # Orders by status
        by_status = data.get('by_status', [])
        if by_status:
            elements.append(Paragraph("Orders by Status", section_style))
            status_data = [['Status', 'Count', 'Total Value']]
            for item in by_status:
                status_data.append([
                    item.get('status', ''),
                    str(item.get('count', 0)),
                    f"${item.get('total_value', 0):.2f}"
                ])
            t = Table(status_data, colWidths=[150, 100, 150])
            t.setStyle(table_style)
            elements.append(t)
        elements.append(Spacer(1, 20))
        
        # Top products
        top = data.get('top_products', [])
        if top:
            elements.append(Paragraph("🏆 Top Products", section_style))
            top_data = [['Flower', 'Quantity Sold', 'Revenue', 'Orders']]
            for item in top:
                top_data.append([
                    item.get('flower_name', f"Flower #{item.get('flower_type_id', '')}"),
                    str(item.get('total_quantity', 0)),
                    f"${item.get('total_revenue', 0):.2f}",
                    str(item.get('order_count', 0))
                ])
            t = Table(top_data, colWidths=[120, 100, 100, 80])
            t.setStyle(table_style)
            elements.append(t)
    
    # Footer
    elements.append(Spacer(1, 40))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER,
        textColor=colors.gray
    )
    elements.append(Paragraph("Generated from BloomFlow Read-Replica Database", footer_style))
    elements.append(Paragraph("© 2026 BloomFlow - Floristry Management System", footer_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


@bp.route('/export/dashboard', methods=['GET'])
@require_role('admin', 'florar')
def export_dashboard_pdf():
    """Export dashboard report as PDF"""
    # Get dashboard data
    sales_query = """
        SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(total_price), 0) as total_revenue,
            COALESCE(AVG(total_price), 0) as average_order_value
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    """
    sales = execute_query(get_orders_connection, sales_query)
    sales_data = sales[0] if sales else {}
    
    status_query = """
        SELECT status, COUNT(*) as count
        FROM orders
        GROUP BY status
    """
    status_data = execute_query(get_orders_connection, status_query)
    
    low_stock_query = """
        SELECT COUNT(*) as count
        FROM (
            SELECT ft.id
            FROM flower_types ft
            LEFT JOIN flower_lots fl ON ft.id = fl.flower_type_id
            GROUP BY ft.id
            HAVING COALESCE(SUM(CASE WHEN fl.status = 'available' AND fl.expiry_date >= CURRENT_DATE THEN fl.quantity ELSE 0 END), 0) < 10
        ) low_stock
    """
    low_stock = execute_query(get_inventory_connection, low_stock_query)
    low_stock_count = low_stock[0]['count'] if low_stock else 0
    
    expiring_query = """
        SELECT COUNT(*) as count
        FROM flower_lots
        WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
          AND status = 'available'
          AND quantity > 0
    """
    expiring = execute_query(get_inventory_connection, expiring_query)
    expiring_count = expiring[0]['count'] if expiring else 0
    
    # Convert Decimals
    for key in sales_data:
        if sales_data[key] is not None and hasattr(sales_data[key], '__float__'):
            sales_data[key] = float(sales_data[key])
    
    data = {
        'sales_last_30_days': sales_data,
        'orders_by_status': status_data,
        'low_stock_items': low_stock_count,
        'expiring_soon_lots': expiring_count
    }
    
    pdf_buffer = generate_pdf_report('dashboard', data)
    
    return Response(
        pdf_buffer.getvalue(),
        mimetype='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename=bloomflow_dashboard_{datetime.now().strftime("%Y%m%d")}.pdf'
        }
    )


@bp.route('/export/sales', methods=['GET'])
@require_role('admin', 'florar')
def export_sales_pdf():
    """Export sales report as PDF"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')
    
    # Summary
    summary_query = """
        SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(total_price), 0) as total_revenue,
            COALESCE(AVG(total_price), 0) as average_order_value,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
        FROM orders
        WHERE created_at >= :start_date AND created_at <= :end_date
    """
    summary = execute_query(get_orders_connection, summary_query, {
        'start_date': start_date,
        'end_date': end_date + ' 23:59:59'
    })
    summary_data = summary[0] if summary else {}
    
    # Daily
    daily_query = """
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as order_count,
            COALESCE(SUM(total_price), 0) as revenue
        FROM orders
        WHERE created_at >= :start_date AND created_at <= :end_date
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    """
    daily_data = execute_query(get_orders_connection, daily_query, {
        'start_date': start_date,
        'end_date': end_date + ' 23:59:59'
    })
    
    # Convert
    for key in summary_data:
        if summary_data[key] is not None and hasattr(summary_data[key], '__float__'):
            summary_data[key] = float(summary_data[key])
    
    for row in daily_data:
        if row.get('date'):
            row['date'] = row['date'].isoformat() if hasattr(row['date'], 'isoformat') else str(row['date'])
        if row.get('revenue') and hasattr(row['revenue'], '__float__'):
            row['revenue'] = float(row['revenue'])
    
    data = {'summary': summary_data, 'daily': daily_data}
    period = {'start_date': start_date, 'end_date': end_date}
    
    pdf_buffer = generate_pdf_report('sales', data, period)
    
    return Response(
        pdf_buffer.getvalue(),
        mimetype='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename=bloomflow_sales_{start_date}_{end_date}.pdf'
        }
    )


@bp.route('/export/inventory', methods=['GET'])
@require_role('admin', 'florar')
def export_inventory_pdf():
    """Export inventory report as PDF"""
    # Levels
    levels_query = """
        SELECT 
            ft.id,
            ft.name,
            ft.color,
            ft.price_per_unit,
            COALESCE(SUM(CASE WHEN fl.status = 'available' AND fl.expiry_date >= CURRENT_DATE THEN fl.quantity ELSE 0 END), 0) as available_stock,
            COUNT(DISTINCT fl.id) as lot_count
        FROM flower_types ft
        LEFT JOIN flower_lots fl ON ft.id = fl.flower_type_id
        GROUP BY ft.id, ft.name, ft.color, ft.price_per_unit
        ORDER BY ft.name
    """
    levels = execute_query(get_inventory_connection, levels_query)
    
    # Low stock
    low_stock_query = """
        SELECT 
            ft.id,
            ft.name,
            ft.color,
            COALESCE(SUM(CASE WHEN fl.status = 'available' AND fl.expiry_date >= CURRENT_DATE THEN fl.quantity ELSE 0 END), 0) as available_stock
        FROM flower_types ft
        LEFT JOIN flower_lots fl ON ft.id = fl.flower_type_id
        GROUP BY ft.id, ft.name, ft.color
        HAVING COALESCE(SUM(CASE WHEN fl.status = 'available' AND fl.expiry_date >= CURRENT_DATE THEN fl.quantity ELSE 0 END), 0) < 10
        ORDER BY available_stock ASC
    """
    low_stock = execute_query(get_inventory_connection, low_stock_query)
    
    # Expiring
    expiring_query = """
        SELECT 
            fl.id as lot_id,
            ft.name as flower_name,
            fl.quantity,
            fl.expiry_date
        FROM flower_lots fl
        JOIN flower_types ft ON fl.flower_type_id = ft.id
        WHERE fl.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
          AND fl.status = 'available'
          AND fl.quantity > 0
        ORDER BY fl.expiry_date ASC
    """
    expiring = execute_query(get_inventory_connection, expiring_query)
    
    # Convert
    for row in levels:
        if row.get('price_per_unit') and hasattr(row['price_per_unit'], '__float__'):
            row['price_per_unit'] = float(row['price_per_unit'])
    
    for row in expiring:
        if row.get('expiry_date'):
            row['expiry_date'] = row['expiry_date'].isoformat() if hasattr(row['expiry_date'], 'isoformat') else str(row['expiry_date'])
    
    data = {'levels': levels, 'low_stock': low_stock, 'expiring': expiring}
    
    pdf_buffer = generate_pdf_report('inventory', data)
    
    return Response(
        pdf_buffer.getvalue(),
        mimetype='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename=bloomflow_inventory_{datetime.now().strftime("%Y%m%d")}.pdf'
        }
    )


@bp.route('/export/orders', methods=['GET'])
@require_role('admin', 'florar')
def export_orders_pdf():
    """Export orders report as PDF"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')
    
    # By status
    status_query = """
        SELECT 
            status,
            COUNT(*) as count,
            COALESCE(SUM(total_price), 0) as total_value
        FROM orders
        GROUP BY status
        ORDER BY count DESC
    """
    by_status = execute_query(get_orders_connection, status_query)
    
    # Top products
    top_query = """
        SELECT 
            oi.flower_type_id,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.subtotal) as total_revenue,
            COUNT(DISTINCT o.id) as order_count
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= :start_date AND o.created_at <= :end_date
        GROUP BY oi.flower_type_id
        ORDER BY total_quantity DESC
        LIMIT 10
    """
    top_products = execute_query(get_orders_connection, top_query, {
        'start_date': start_date,
        'end_date': end_date + ' 23:59:59'
    })
    
    # Get flower names
    if top_products:
        flower_ids = [r['flower_type_id'] for r in top_products]
        flower_query = f"""
            SELECT id, name, color FROM flower_types WHERE id IN ({','.join(map(str, flower_ids))})
        """
        flowers = execute_query(get_inventory_connection, flower_query)
        flower_map = {f['id']: f for f in flowers}
        
        for row in top_products:
            flower_info = flower_map.get(row['flower_type_id'], {})
            row['flower_name'] = flower_info.get('name', f"Flower #{row['flower_type_id']}")
            if row.get('total_revenue') and hasattr(row['total_revenue'], '__float__'):
                row['total_revenue'] = float(row['total_revenue'])
    
    # Convert status values
    for row in by_status:
        if row.get('total_value') and hasattr(row['total_value'], '__float__'):
            row['total_value'] = float(row['total_value'])
    
    data = {'by_status': by_status, 'top_products': top_products}
    period = {'start_date': start_date, 'end_date': end_date}
    
    pdf_buffer = generate_pdf_report('orders', data, period)
    
    return Response(
        pdf_buffer.getvalue(),
        mimetype='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename=bloomflow_orders_{start_date}_{end_date}.pdf'
        }
    )
