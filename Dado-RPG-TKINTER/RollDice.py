import random
import tkinter as tk
import ttkbootstrap as tb
from tkinter import messagebox, ttk, simpledialog
from datetime import datetime
import json
import os

class ScrollableFrame(ttk.Frame):
    def __init__(self, container, *args, **kwargs):
        super().__init__(container, *args, **kwargs)
        canvas = tk.Canvas(self)
        scrollbar = ttk.Scrollbar(self, orient="vertical", command=canvas.yview)
        self.scrollable_frame = ttk.Frame(canvas)
        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(
                scrollregion=canvas.bbox("all")
            )
        )
        canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

class DiceRollerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Rolagem de Dados Avançada")
        self.root.geometry("860x780")
        self.root.minsize(720, 640)

        # Tema inicial escuro
        self.style = tb.Style("darkly")
        self.is_dark = True

        self.current_result = tk.StringVar()
        self.current_result.set("Selecione um dado e clique em Rolar!")
        self.last_roll = None
        self.modifier = tk.IntVar(value=0)
        self.roll_mode = tk.StringVar(value="normal")
        self.num_dice = tk.IntVar(value=1)
        self.history = []

        # Carregar dados da ficha  
        self.load_character_data()
        
        # --- Notebook para abas ---
        self.notebook = tb.Notebook(root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        # Frame para a aba de rolagem de dados
        self.dice_frame = tb.Frame(self.notebook, padding=10)
        self.notebook.add(self.dice_frame, text="Rolagem de Dados")

        # Frame para a aba de ficha
        self.character_frame = tb.Frame(self.notebook, padding=10)
        self.notebook.add(self.character_frame, text="Ficha")

        # --- Botão alternar tema ---
        self.theme_button = tb.Button(
            self.dice_frame,
            text="🌙 Alternar Tema",
            bootstyle="secondary-outline",
            command=self.toggle_theme
        )
        self.theme_button.pack(pady=5)

        # --- Conteúdo da aba de dados ---
        self.result_label = tb.Label(
            self.dice_frame,
            textvariable=self.current_result,
            wraplength=500,
            justify="center",
            font=("Helvetica", 14, "bold")
        )
        self.result_label.pack(pady=15, fill=tk.X)

        # --- Seção de escolha do dado ---
        dice_frame = tb.Labelframe(self.dice_frame, text="Tipo de Dado", bootstyle="primary", padding=10)
        dice_frame.pack(fill=tk.X, pady=8)

        self.dice_type = tk.StringVar(value="d20")
        dice_options = [
            ("D4 (4 lados)", "d4"),
            ("D6 (6 lados)", "d6"),
            ("D8 (8 lados)", "d8"),
            ("D10 (10 lados)", "d10"),
            ("D12 (12 lados)", "d12"),
            ("D20 (20 lados)", "d20"),
            ("D100 (1-100)", "d100"),
            ("D% (10% a 100%)", "dpercent"),
        ]
        
        radio_frame = tb.Frame(dice_frame)
        radio_frame.pack(fill=tk.X)
        
        left_frame = tb.Frame(radio_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))
        
        right_frame = tb.Frame(radio_frame)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(5, 0))
        
        self.radio_buttons = []
        for i, (text, val) in enumerate(dice_options):
            frame = left_frame if i < 4 else right_frame
            rb = tb.Radiobutton(frame, text=text, variable=self.dice_type, value=val, bootstyle="info-round-toggle")
            rb.pack(anchor="w", pady=2, fill=tk.X)
            self.radio_buttons.append(rb)

        # --- Modo de rolagem ---
        mode_frame = tb.Labelframe(self.dice_frame, text="Modo de Rolagem", bootstyle="primary", padding=10)
        mode_frame.pack(fill=tk.X, pady=8)

        self.mode_buttons = []
        mode_btn_frame = tb.Frame(mode_frame)
        mode_btn_frame.pack(fill=tk.X)

        for text, val in [("Normal", "normal"), ("Vantagem", "vantagem"), ("Desvantagem", "desvantagem")]:
            rb = tb.Radiobutton(mode_btn_frame, text=text, variable=self.roll_mode, value=val, bootstyle="info-round-toggle")
            rb.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=4)
            self.mode_buttons.append(rb)

        # --- Quantidade + Modificador (lado a lado) ---
        qm_outer = tb.Labelframe(self.dice_frame, text="Configurações de Rolagem", bootstyle="primary", padding=10)
        qm_outer.pack(fill=tk.X, pady=8)

        tb.Label(qm_outer, text="Qtd de dados (1-8):").pack(side="left")
        self.dice_quantity = tb.Spinbox(qm_outer, from_=1, to=8, textvariable=self.num_dice, width=5, bootstyle="success")
        self.dice_quantity.pack(side="left", padx=(4, 20))

        tb.Label(qm_outer, text="Modificador:").pack(side="left")
        self.modifier_spinbox = tb.Spinbox(qm_outer, from_=-99, to=99, textvariable=self.modifier, width=5, bootstyle="warning")
        self.modifier_spinbox.pack(side="left", padx=4)

        # --- Dado Customizado ---
        self.custom_sides = tk.IntVar(value=6)
        self.use_custom = tk.BooleanVar(value=False)

        custom_frame = tb.Labelframe(self.dice_frame, text="Dado Customizado", bootstyle="warning", padding=10)
        custom_frame.pack(fill=tk.X, pady=8)

        custom_cb = tb.Checkbutton(custom_frame, text="Usar dado customizado",
                                   variable=self.use_custom, bootstyle="warning-round-toggle",
                                   command=self._on_custom_toggle)
        custom_cb.pack(side=tk.LEFT)
        self.mode_buttons.append(custom_cb)

        tb.Label(custom_frame, text="   Nº de lados:").pack(side=tk.LEFT)
        self.custom_spinbox = tb.Spinbox(custom_frame, from_=2, to=9999, textvariable=self.custom_sides, width=7, bootstyle="warning")
        self.custom_spinbox.pack(side=tk.LEFT, padx=4)

        self.custom_label = tb.Label(custom_frame, text="→ D6", font=("Helvetica", 12, "bold"), bootstyle="warning")
        self.custom_label.pack(side=tk.LEFT, padx=8)
        self.custom_sides.trace_add("write", lambda *_: self.custom_label.config(
            text=f"→ D{self.custom_sides.get()}" if str(self.custom_sides.get()).isdigit() else "→ D?"))

        # --- Botões principais ---
        button_frame = tb.Frame(self.dice_frame)
        button_frame.pack(pady=20, fill=tk.X)

        self.roll_button = tb.Button(button_frame, text="🎲 Rolar", bootstyle="success-outline", command=self.roll_dice, width=10)
        self.roll_button.pack(side=tk.LEFT, padx=5, expand=True)

        self.reroll_button = tb.Button(button_frame, text="🔄 Rerolar (Desvantagem)", bootstyle="info-outline", command=self.reroll_dice, state="disabled")
        self.reroll_button.pack(side=tk.LEFT, padx=5, expand=True)

        self.reset_button = tb.Button(button_frame, text="⏹ Resetar", bootstyle="danger-outline", command=self.reset_dice, width=10)
        self.reset_button.pack(side=tk.LEFT, padx=5, expand=True)

        # --- Histórico ---
        secondary_button_frame = tb.Frame(self.dice_frame)
        secondary_button_frame.pack(pady=10, fill=tk.X)

        self.history_button = tb.Button(secondary_button_frame, text="📜 Histórico", bootstyle="secondary-outline", command=self.show_history)
        self.history_button.pack(side=tk.LEFT, padx=5, expand=True)

        self.clear_history_button = tb.Button(secondary_button_frame, text="🗑 Limpar Histórico", bootstyle="danger-outline", command=self.clear_history)
        self.clear_history_button.pack(side=tk.LEFT, padx=5, expand=True)



        # --- Conteúdo da aba de ficha ---
        self.setup_character_tab()

    def load_character_data(self):
        """Carrega dados das fichas de personagem de um arquivo JSON único"""
        try:
            if os.path.exists("character_data.json"):
                with open("character_data.json", "r") as f:
                    data = json.load(f)
                self.demi_data = data.get('demi', {})
                self.nahobino_data = data.get('nahobino', {})
                self.samurai_data = data.get('samurai', {})
                self.persona_user_data = data.get('persona_user', {})
                self.cyberpunk_data = data.get('cyberpunk', {})
                self.warhammer_data = data.get('warhammer', {})
            else:
                self.demi_data = {}
                self.nahobino_data = {}
                self.samurai_data = {}
                self.persona_user_data = {}
                self.cyberpunk_data = {}
                self.warhammer_data = {}
        except Exception as e:
            print(f"Erro ao carregar dados: {e}")
            self.demi_data = {}
            self.nahobino_data = {}
            self.samurai_data = {}
            self.persona_user_data = {}
            self.cyberpunk_data = {}
            self.warhammer_data = {}

    def save_character_data(self):
        """Salva dados das fichas de personagem em um arquivo JSON único"""
        try:
            data = {
                'demi': self.demi_data,
                'nahobino': self.nahobino_data,
                'samurai': self.samurai_data,
                'persona_user': self.persona_user_data,
                'cyberpunk': self.cyberpunk_data,
                'warhammer': self.warhammer_data
            }
            with open("character_data.json", "w") as f:
                json.dump(data, f)
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao salvar dados: {e}")

    def toggle_theme(self):
        """Alterna entre 'darkly' e 'flatly' e ajusta estilos dos widgets."""
        if self.is_dark:
            self.style.theme_use("flatly")
            self.is_dark = False
            self.result_label.configure(foreground="black")
            for rb in self.radio_buttons + self.mode_buttons:
                self.smooth_transition(rb, "dark-round-toggle")
            self.roll_button.configure(bootstyle="success")
            self.reroll_button.configure(bootstyle="info")
            self.reset_button.configure(bootstyle="danger")
            self.history_button.configure(bootstyle="secondary")
            self.clear_history_button.configure(bootstyle="danger")
            self.theme_button.configure(text="🌞 Alternar Tema", bootstyle="secondary")
        else:
            self.style.theme_use("darkly")
            self.is_dark = True
            self.result_label.configure(foreground="white")
            for rb in self.radio_buttons + self.mode_buttons:
                self.smooth_transition(rb, "info-round-toggle")
            self.roll_button.configure(bootstyle="success-outline")
            self.reroll_button.configure(bootstyle="info-outline")
            self.reset_button.configure(bootstyle="danger-outline")
            self.history_button.configure(bootstyle="secondary-outline")
            self.clear_history_button.configure(bootstyle="danger-outline")
            self.theme_button.configure(text="🌙 Alternar Tema", bootstyle="secondary-outline")

    def _on_custom_toggle(self):
        pass  # estado gerenciado por use_custom var; roll_dice verifica antes dos radio buttons

    def smooth_transition(self, widget, new_style, steps=8, delay=18):
        def step(count=0):
            if count >= steps:
                widget.configure(bootstyle=new_style)
                return
            self.root.after(delay, lambda: step(count + 1))
        step()

    def setup_character_tab(self):
        char_notebook = tb.Notebook(self.character_frame)
        char_notebook.pack(fill=tk.BOTH, expand=True)

        cyberpunk_frame = tb.Frame(char_notebook, padding=10)
        char_notebook.add(cyberpunk_frame, text="Cyberpunk")

        cthulhu_frame = tb.Frame(char_notebook, padding=10)
        char_notebook.add(cthulhu_frame, text="Cthulhu")
        tb.Label(cthulhu_frame, text="Sistema Cthulhu - Em desenvolvimento").pack(pady=20)

        warhammer_frame = tb.Frame(char_notebook, padding=10)
        char_notebook.add(warhammer_frame, text="Warhammer")

        smt_frame = tb.Frame(char_notebook, padding=10)
        char_notebook.add(smt_frame, text="SMT")

        self.setup_cyberpunk_tab(cyberpunk_frame)
        self.setup_warhammer_tab(warhammer_frame)
        self.setup_smt_tab(smt_frame)

    # --- SMT TAB ---
    def setup_smt_tab(self, parent):
        smt_notebook = tb.Notebook(parent)
        smt_notebook.pack(fill=tk.BOTH, expand=True)

        demi_frame = tb.Frame(smt_notebook, padding=10)
        nahobino_frame = tb.Frame(smt_notebook, padding=10)
        samurai_frame = tb.Frame(smt_notebook, padding=10)
        persona_user_frame = tb.Frame(smt_notebook, padding=10)

        smt_notebook.add(demi_frame, text="Demi-fiend")
        smt_notebook.add(nahobino_frame, text="Nahobino")
        smt_notebook.add(samurai_frame, text="Samurai")
        smt_notebook.add(persona_user_frame, text="Persona-User")

        self.setup_demi_fiend_tab(demi_frame)
        self.setup_nahobino_tab(nahobino_frame)
        self.setup_samurai_tab(samurai_frame)
        self.setup_persona_user_tab(persona_user_frame)

    def setup_demi_fiend_tab(self, parent):
        frame = ScrollableFrame(parent)
        frame.pack(fill=tk.BOTH, expand=True)
        sf = frame.scrollable_frame

        # Initialize attributes first
        self.demi_pv = tk.IntVar(value=100)
        self.demi_pm = tk.IntVar(value=50)
        self.demi_level = tk.IntVar(value=1)
        self.demi_attrs = {}
        for name in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]:
            self.demi_attrs[name] = tk.IntVar(value=10)
        self.magatamas = []
        self.magatama_var = tk.StringVar()
        self.demi_skills_listbox = tk.Listbox()
        self.demi_passive_listbox = tk.Listbox()
        self.demi_inventory_listbox = tk.Listbox()
        self.demi_key_listbox = tk.Listbox()

        # Combobox para seleção de ficha
        tb.Label(sf, text="Ficha atual:").pack()
        self.demi_chars_var = tk.StringVar()
        self.demi_chars_combo = ttk.Combobox(sf, textvariable=self.demi_chars_var, state="readonly")
        self.demi_chars_combo.pack()
        self.demi_chars_combo.bind("<<ComboboxSelected>>", self.load_demi_character)

        tb.Button(sf, text="Nova Ficha", command=self.new_demi_character, bootstyle="success-outline").pack(pady=2)

        # Magatamas
        magatama_frame = tb.Labelframe(sf, text="Magatamas", bootstyle="warning")
        magatama_frame.pack(fill=tk.X, pady=5)
        tb.Label(magatama_frame, text="Equipada:").pack(side=tk.LEFT)
        self.magatama_combo = ttk.Combobox(magatama_frame, textvariable=self.magatama_var, values=self.magatamas, state="readonly", width=20)
        self.magatama_combo.pack(side=tk.LEFT, padx=5)
        self.magatama_combo.bind("<<ComboboxSelected>>", lambda e: self.save_current_demi())
        magatama_entry = tb.Entry(magatama_frame, width=18)
        magatama_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(magatama_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_magatama(magatama_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(magatama_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_magatama).pack(side=tk.LEFT, padx=5)

        # PV/PM
        pv_pm_frame = tb.Labelframe(sf, text="PV / PM", bootstyle="danger")
        pv_pm_frame.pack(fill=tk.X, pady=5)
        tb.Label(pv_pm_frame, text="PV:").pack(side=tk.LEFT)
        tb.Spinbox(pv_pm_frame, from_=0, to=999, textvariable=self.demi_pv, width=6,
                   command=lambda: self.save_current_demi()).pack(side=tk.LEFT, padx=5)
        tb.Label(pv_pm_frame, text="PM:").pack(side=tk.LEFT)
        tb.Spinbox(pv_pm_frame, from_=0, to=999, textvariable=self.demi_pm, width=6,
                   command=lambda: self.save_current_demi()).pack(side=tk.LEFT, padx=5)
        tb.Label(pv_pm_frame, text="Level:").pack(side=tk.LEFT)
        tb.Spinbox(pv_pm_frame, from_=1, to=99, textvariable=self.demi_level, width=4,
                   command=lambda: self.save_current_demi()).pack(side=tk.LEFT, padx=5)

        # Atributos
        attr_frame = tb.Labelframe(sf, text="Atributos", bootstyle="info")
        attr_frame.pack(fill=tk.X, pady=5)
        for name in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]:
            tb.Label(attr_frame, text=f"{name}:").pack(side=tk.LEFT, padx=2)
            tb.Spinbox(attr_frame, from_=1, to=99, textvariable=self.demi_attrs[name], width=4,
                       command=lambda n=name, v=self.demi_attrs[name]: self.update_demi_attribute(n, v.get())).pack(side=tk.LEFT, padx=2)

        # Skills
        skills_frame = tb.Labelframe(sf, text="Skills", bootstyle="primary")
        skills_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.demi_skills_listbox = tk.Listbox(skills_frame, height=6)
        self.demi_skills_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        controls_frame = tb.Frame(skills_frame)
        controls_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5)
        skill_entry = tb.Entry(controls_frame, width=18)
        skill_entry.pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_demi_skill(skill_entry)).pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_demi_skill).pack(fill=tk.X, pady=2)

        # Habilidades Passivas
        passive_frame = tb.Labelframe(sf, text="Habilidades Passivas", bootstyle="info")
        passive_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.demi_passive_listbox = tk.Listbox(passive_frame, height=6)
        self.demi_passive_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        controls_frame = tb.Frame(passive_frame)
        controls_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5)
        passive_entry = tb.Entry(controls_frame, width=18)
        passive_entry.pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_demi_passive(passive_entry)).pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_demi_passive).pack(fill=tk.X, pady=2)

        # Inventário
        inv_frame = tb.Labelframe(sf, text="Inventário", bootstyle="success")
        inv_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.demi_inventory_listbox = tk.Listbox(inv_frame, height=6)
        self.demi_inventory_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        controls_frame = tb.Frame(inv_frame)
        controls_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5)
        inv_entry = tb.Entry(controls_frame, width=18)
        inv_entry.pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_demi_item(inv_entry)).pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_demi_item).pack(fill=tk.X, pady=2)

        # Itens chave
        key_frame = tb.Labelframe(sf, text="Itens Chave", bootstyle="warning")
        key_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.demi_key_listbox = tk.Listbox(key_frame, height=6)
        self.demi_key_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        key_entry = tb.Entry(key_frame, width=18)
        key_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(key_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_demi_key_item(key_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(key_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_demi_key_item).pack(side=tk.LEFT, padx=5)
        self.update_demi_chars_list()

    def update_demi_chars_list(self):
        self.demi_chars_combo['values'] = list(self.demi_data.keys())
        if self.demi_chars_combo['values']:
            self.demi_chars_combo.current(0)
            self.load_demi_character()

    def new_demi_character(self):
        name = simpledialog.askstring("Nova Ficha Demi-fiend", "Nome da nova ficha:")
        if name and name.strip():
            if name in self.demi_data:
                messagebox.showerror("Erro", "Já existe uma ficha com este nome!")
                return
            self.demi_data[name] = {
                'pv': 100,
                'pm': 50,
                'level': 1,
                'attributes': {k: 10 for k in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]},
                'magatamas': [],
                'magatama_equipped': "",
                'skills': [],
                'passives': [],
                'inventory': [],
                'key_items': []
            }
            self.save_character_data()
            self.update_demi_chars_list()
            self.demi_chars_combo.set(name)
            self.load_demi_character()
            messagebox.showinfo("Sucesso", f"Ficha '{name}' criada e salva!")

    def load_demi_character(self, event=None):
        name = self.demi_chars_combo.get()
        if name in self.demi_data:
            data = self.demi_data[name]
            self.demi_pv.set(data['pv'])
            self.demi_pm.set(data['pm'])
            self.demi_level.set(data.get('level', 1))

            for attr in self.demi_attrs:
                self.demi_attrs[attr].set(data['attributes'].get(attr, 10))

            self.magatamas = data['magatamas']
            self.magatama_combo['values'] = self.magatamas
            self.magatama_var.set(data['magatama_equipped'])

            self.demi_skills_listbox.delete(0, tk.END)
            for skill in data['skills']:
                self.demi_skills_listbox.insert(tk.END, skill)

            self.demi_passive_listbox.delete(0, tk.END)
            for passive in data['passives']:
                self.demi_passive_listbox.insert(tk.END, passive)

            self.demi_inventory_listbox.delete(0, tk.END)
            for item in data['inventory']:
                self.demi_inventory_listbox.insert(tk.END, item)

            self.demi_key_listbox.delete(0, tk.END)
            for key_item in data['key_items']:
                self.demi_key_listbox.insert(tk.END, key_item)

    def save_current_demi(self):
        name = self.demi_chars_combo.get()
        if name in self.demi_data:
            self.demi_data[name]['pv'] = self.demi_pv.get()
            self.demi_data[name]['pm'] = self.demi_pm.get()
            self.demi_data[name]['level'] = self.demi_level.get()
            self.demi_data[name]['attributes'] = {attr: self.demi_attrs[attr].get() for attr in self.demi_attrs}
            self.demi_data[name]['magatamas'] = self.magatamas
            self.demi_data[name]['magatama_equipped'] = self.magatama_var.get()
            self.demi_data[name]['skills'] = list(self.demi_skills_listbox.get(0, tk.END))
            self.demi_data[name]['passives'] = list(self.demi_passive_listbox.get(0, tk.END))
            self.demi_data[name]['inventory'] = list(self.demi_inventory_listbox.get(0, tk.END))
            self.demi_data[name]['key_items'] = list(self.demi_key_listbox.get(0, tk.END))
            self.save_character_data()

    def update_demi_attribute(self, attr, value):
        name = self.demi_chars_combo.get()
        if name in self.demi_data:
            self.demi_data[name]['attributes'][attr] = value
            self.save_character_data()

    def add_magatama(self, entry):
        name = entry.get().strip()
        if name and name not in self.magatamas:
            self.magatamas.append(name)
            self.magatama_combo['values'] = self.magatamas
            entry.delete(0, tk.END)
            self.save_current_demi()

    def add_demi_skill(self, entry):
        skill = entry.get().strip()
        if skill:
            self.demi_skills_listbox.insert(tk.END, skill)
            entry.delete(0, tk.END)
            self.save_current_demi()

    def add_demi_passive(self, entry):
        passive = entry.get().strip()
        if passive:
            self.demi_passive_listbox.insert(tk.END, passive)
            entry.delete(0, tk.END)
            self.save_current_demi()

    def add_demi_item(self, entry):
        item = entry.get().strip()
        if item:
            self.demi_inventory_listbox.insert(tk.END, item)
            entry.delete(0, tk.END)
            self.save_current_demi()

    def add_demi_key_item(self, entry):
        key_item = entry.get().strip()
        if key_item:
            self.demi_key_listbox.insert(tk.END, key_item)
            entry.delete(0, tk.END)
            self.save_current_demi()

    def remove_demi_skill(self):
        selection = self.demi_skills_listbox.curselection()
        if selection:
            self.demi_skills_listbox.delete(selection[0])
            self.save_current_demi()

    def remove_demi_passive(self):
        selection = self.demi_passive_listbox.curselection()
        if selection:
            self.demi_passive_listbox.delete(selection[0])
            self.save_current_demi()

    def remove_demi_item(self):
        selection = self.demi_inventory_listbox.curselection()
        if selection:
            self.demi_inventory_listbox.delete(selection[0])
            self.save_current_demi()

    def remove_demi_key_item(self):
        selection = self.demi_key_listbox.curselection()
        if selection:
            self.demi_key_listbox.delete(selection[0])
            self.save_current_demi()

    def remove_magatama(self):
        selected = self.magatama_var.get()
        if selected and selected in self.magatamas:
            self.magatamas.remove(selected)
            self.magatama_combo['values'] = self.magatamas
            if self.magatamas:
                self.magatama_var.set(self.magatamas[0])
            else:
                self.magatama_var.set("")
            self.save_current_demi()

    def setup_nahobino_tab(self, parent):
        frame = ScrollableFrame(parent)
        frame.pack(fill=tk.BOTH, expand=True)
        sf = frame.scrollable_frame

        tb.Label(sf, text="Ficha atual:").pack()
        self.nahobino_chars_var = tk.StringVar()
        self.nahobino_chars_combo = ttk.Combobox(sf, textvariable=self.nahobino_chars_var, state="readonly")
        self.nahobino_chars_combo.pack()
        self.nahobino_chars_combo.bind("<<ComboboxSelected>>", self.load_nahobino_character)

        # Initialize attributes first
        self.nahobino_pv = tk.IntVar(value=100)
        self.nahobino_pm = tk.IntVar(value=50)
        self.nahobino_level = tk.IntVar(value=1)
        self.nahobino_attrs = {}
        for name in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]:
            self.nahobino_attrs[name] = tk.IntVar(value=10)
        self.nahobino_essences = []
        self.nahobino_essence_var = tk.StringVar()
        self.nahobino_skills_listbox = tk.Listbox()
        self.nahobino_passive_listbox = tk.Listbox()
        self.nahobino_inventory_listbox = tk.Listbox()
        self.nahobino_key_listbox = tk.Listbox()

        tb.Button(sf, text="Nova Ficha", command=self.new_nahobino_character, bootstyle="success-outline").pack(pady=2)

        pv_pm_frame = tb.Labelframe(sf, text="PV / PM", bootstyle="danger")
        pv_pm_frame.pack(fill=tk.X, pady=5)
        tb.Label(pv_pm_frame, text="PV:").pack(side=tk.LEFT)
        tb.Spinbox(pv_pm_frame, from_=0, to=999, textvariable=self.nahobino_pv, width=6,
                   command=lambda: self.save_current_nahobino()).pack(side=tk.LEFT, padx=5)
        tb.Label(pv_pm_frame, text="PM:").pack(side=tk.LEFT)
        tb.Spinbox(pv_pm_frame, from_=0, to=999, textvariable=self.nahobino_pm, width=6,
                   command=lambda: self.save_current_nahobino()).pack(side=tk.LEFT, padx=5)
        tb.Label(pv_pm_frame, text="Level:").pack(side=tk.LEFT)
        tb.Spinbox(pv_pm_frame, from_=1, to=99, textvariable=self.nahobino_level, width=4,
                   command=lambda: self.save_current_nahobino()).pack(side=tk.LEFT, padx=5)

        attr_frame = tb.Labelframe(sf, text="Atributos", bootstyle="info")
        attr_frame.pack(fill=tk.X, pady=5)
        for name in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]:
            tb.Label(attr_frame, text=f"{name}:").pack(side=tk.LEFT, padx=2)
            tb.Spinbox(attr_frame, from_=1, to=99, textvariable=self.nahobino_attrs[name], width=4,
                       command=lambda n=name, v=self.nahobino_attrs[name]: self.update_nahobino_attribute(n, v.get())).pack(side=tk.LEFT, padx=2)

        essence_frame = tb.Labelframe(sf, text="Essências", bootstyle="warning")
        essence_frame.pack(fill=tk.X, pady=5)
        self.nahobino_essences = []
        self.nahobino_essence_var = tk.StringVar()
        self.nahobino_essence_combo = ttk.Combobox(essence_frame, textvariable=self.nahobino_essence_var, values=self.nahobino_essences, state="readonly", width=20)
        self.nahobino_essence_combo.pack(side=tk.LEFT, padx=5)
        self.nahobino_essence_combo.bind("<<ComboboxSelected>>", lambda e: self.save_current_nahobino())
        essence_entry = tb.Entry(essence_frame, width=18)
        essence_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(essence_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_nahobino_essence(essence_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(essence_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_nahobino_essence).pack(side=tk.LEFT, padx=5)

        skills_frame = tb.Labelframe(sf, text="Skills", bootstyle="primary")
        skills_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.nahobino_skills_listbox = tk.Listbox(skills_frame, height=6)
        self.nahobino_skills_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        controls_frame = tb.Frame(skills_frame)
        controls_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5)
        skill_entry = tb.Entry(controls_frame, width=18)
        skill_entry.pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_nahobino_skill(skill_entry)).pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_nahobino_skill).pack(fill=tk.X, pady=2)

        passive_frame = tb.Labelframe(sf, text="Habilidades Passivas", bootstyle="info")
        passive_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.nahobino_passive_listbox = tk.Listbox(passive_frame, height=6)
        self.nahobino_passive_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        passive_entry = tb.Entry(passive_frame, width=18)
        passive_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(passive_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_nahobino_passive(passive_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(passive_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_nahobino_passive).pack(side=tk.LEFT, padx=5)

        inv_frame = tb.Labelframe(sf, text="Inventário", bootstyle="success")
        inv_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.nahobino_inventory_listbox = tk.Listbox(inv_frame, height=6)
        self.nahobino_inventory_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        inv_entry = tb.Entry(inv_frame, width=18)
        inv_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(inv_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_nahobino_item(inv_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(inv_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_nahobino_item).pack(side=tk.LEFT, padx=5)

        key_frame = tb.Labelframe(sf, text="Itens Chave", bootstyle="warning")
        key_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.nahobino_key_listbox = tk.Listbox(key_frame, height=6)
        self.nahobino_key_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        key_entry = tb.Entry(key_frame, width=18)
        key_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(key_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_nahobino_key_item(key_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(key_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_nahobino_key_item).pack(side=tk.LEFT, padx=5)
        self.update_nahobino_chars_list()

    def update_nahobino_chars_list(self):
        self.nahobino_chars_combo['values'] = list(self.nahobino_data.keys())
        if self.nahobino_chars_combo['values']:
            self.nahobino_chars_combo.current(0)
            self.load_nahobino_character()

    def new_nahobino_character(self):
        name = simpledialog.askstring("Nova Ficha Nahobino", "Nome da nova ficha:")
        if name and name.strip():
            if name in self.nahobino_data:
                messagebox.showerror("Erro", "Já existe uma ficha com este nome!")
                return
            self.nahobino_data[name] = {
                'pv': 100,
                'pm': 50,
                'level': 1,
                'attributes': {k: 10 for k in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]},
                'essences': [],
                'essence_equipped': "",
                'skills': [],
                'passives': [],
                'inventory': [],
                'key_items': []
            }
            self.save_character_data()
            self.update_nahobino_chars_list()
            self.nahobino_chars_combo.set(name)
            self.load_nahobino_character()
            messagebox.showinfo("Sucesso", f"Ficha '{name}' criada e salva!")

    def load_nahobino_character(self, event=None):
        name = self.nahobino_chars_combo.get()
        if name in self.nahobino_data:
            data = self.nahobino_data[name]
            self.nahobino_pv.set(data.get('pv', 100))
            self.nahobino_pm.set(data.get('pm', 50))
            self.nahobino_level.set(data.get('level', 1))
            for attr in self.nahobino_attrs:
                self.nahobino_attrs[attr].set(data['attributes'].get(attr, 10))
            self.nahobino_essences = data.get('essences', [])
            self.nahobino_essence_combo['values'] = self.nahobino_essences
            self.nahobino_essence_var.set(data.get('essence_equipped', ''))
            self.nahobino_skills_listbox.delete(0, tk.END)
            for skill in data['skills']:
                self.nahobino_skills_listbox.insert(tk.END, skill)
            self.nahobino_passive_listbox.delete(0, tk.END)
            for passive in data['passives']:
                self.nahobino_passive_listbox.insert(tk.END, passive)
            self.nahobino_inventory_listbox.delete(0, tk.END)
            for item in data['inventory']:
                self.nahobino_inventory_listbox.insert(tk.END, item)
            self.nahobino_key_listbox.delete(0, tk.END)
            for key_item in data['key_items']:
                self.nahobino_key_listbox.insert(tk.END, key_item)

    def save_current_nahobino(self):
        name = self.nahobino_chars_combo.get()
        if name in self.nahobino_data:
            self.nahobino_data[name]['pv'] = self.nahobino_pv.get()
            self.nahobino_data[name]['pm'] = self.nahobino_pm.get()
            self.nahobino_data[name]['level'] = self.nahobino_level.get()
            self.nahobino_data[name]['attributes'] = {attr: self.nahobino_attrs[attr].get() for attr in self.nahobino_attrs}
            self.nahobino_data[name]['essences'] = self.nahobino_essences
            self.nahobino_data[name]['essence_equipped'] = self.nahobino_essence_var.get()
            self.nahobino_data[name]['skills'] = list(self.nahobino_skills_listbox.get(0, tk.END))
            self.nahobino_data[name]['passives'] = list(self.nahobino_passive_listbox.get(0, tk.END))
            self.nahobino_data[name]['inventory'] = list(self.nahobino_inventory_listbox.get(0, tk.END))
            self.nahobino_data[name]['key_items'] = list(self.nahobino_key_listbox.get(0, tk.END))
            self.save_character_data()

    def update_nahobino_attribute(self, attr, value):
        name = self.nahobino_chars_combo.get()
        if name in self.nahobino_data:
            self.nahobino_data[name]['attributes'][attr] = value
            self.save_character_data()

    def add_nahobino_essence(self, entry):
        name = entry.get().strip()
        if name and name not in self.nahobino_essences:
            self.nahobino_essences.append(name)
            self.nahobino_essence_combo['values'] = self.nahobino_essences
            entry.delete(0, tk.END)
            self.save_current_nahobino()

    def add_nahobino_skill(self, entry):
        skill = entry.get().strip()
        if skill:
            self.nahobino_skills_listbox.insert(tk.END, skill)
            entry.delete(0, tk.END)
            self.save_current_nahobino()

    def add_nahobino_passive(self, entry):
        passive = entry.get().strip()
        if passive:
            self.nahobino_passive_listbox.insert(tk.END, passive)
            entry.delete(0, tk.END)
            self.save_current_nahobino()

    def add_nahobino_item(self, entry):
        item = entry.get().strip()
        if item:
            self.nahobino_inventory_listbox.insert(tk.END, item)
            entry.delete(0, tk.END)
            self.save_current_nahobino()

    def add_nahobino_key_item(self, entry):
        key_item = entry.get().strip()
        if key_item:
            self.nahobino_key_listbox.insert(tk.END, key_item)
            entry.delete(0, tk.END)
            self.save_current_nahobino()

    def remove_nahobino_skill(self):
        selection = self.nahobino_skills_listbox.curselection()
        if selection:
            self.nahobino_skills_listbox.delete(selection[0])
            self.save_current_nahobino()

    def remove_nahobino_passive(self):
        selection = self.nahobino_passive_listbox.curselection()
        if selection:
            self.nahobino_passive_listbox.delete(selection[0])
            self.save_current_nahobino()

    def remove_nahobino_item(self):
        selection = self.nahobino_inventory_listbox.curselection()
        if selection:
            self.nahobino_inventory_listbox.delete(selection[0])
            self.save_current_nahobino()

    def remove_nahobino_key_item(self):
        selection = self.nahobino_key_listbox.curselection()
        if selection:
            self.nahobino_key_listbox.delete(selection[0])
            self.save_current_nahobino()

    def remove_nahobino_essence(self):
        selected = self.nahobino_essence_var.get()
        if selected and selected in self.nahobino_essences:
            self.nahobino_essences.remove(selected)
            self.nahobino_essence_combo['values'] = self.nahobino_essences
            if self.nahobino_essences:
                self.nahobino_essence_var.set(self.nahobino_essences[0])
            else:
                self.nahobino_essence_var.set("")
            self.save_current_nahobino()

    def setup_samurai_tab(self, parent):
        frame = ScrollableFrame(parent)
        frame.pack(fill=tk.BOTH, expand=True)
        sf = frame.scrollable_frame

        # Initialize attributes first
        self.samurai_pv = tk.IntVar(value=100)
        self.samurai_pm = tk.IntVar(value=50)
        self.samurai_level = tk.IntVar(value=1)
        self.samurai_attrs = {}
        self.samurai_skills_listbox = tk.Listbox()
        self.samurai_passive_listbox = tk.Listbox()
        self.samurai_inventory_listbox = tk.Listbox()
        self.samurai_key_listbox = tk.Listbox()

        tb.Label(sf, text="Ficha atual:").pack(anchor="w", pady=(5, 0))
        self.samurai_chars_var = tk.StringVar()
        self.samurai_chars_combo = ttk.Combobox(sf, textvariable=self.samurai_chars_var, state="readonly")
        self.samurai_chars_combo.pack(fill=tk.X, pady=(0, 5))
        self.samurai_chars_combo.bind("<<ComboboxSelected>>", self.load_samurai_character)

        tb.Button(sf, text="Nova Ficha", command=self.new_samurai_character, bootstyle="success-outline").pack(pady=5)

        pv_pm_frame = tb.Labelframe(sf, text="PV / PM", bootstyle="danger")
        pv_pm_frame.pack(fill=tk.X, pady=5)
        tb.Label(pv_pm_frame, text="PV:").grid(row=0, column=0, sticky="w", padx=5, pady=5)
        tb.Spinbox(pv_pm_frame, from_=0, to=999, textvariable=self.samurai_pv, width=6,
                   command=lambda: self.save_current_samurai()).grid(row=0, column=1, sticky="w", padx=5, pady=5)
        tb.Label(pv_pm_frame, text="PM:").grid(row=0, column=2, sticky="w", padx=5, pady=5)
        tb.Spinbox(pv_pm_frame, from_=0, to=999, textvariable=self.samurai_pm, width=6,
                   command=lambda: self.save_current_samurai()).grid(row=0, column=3, sticky="w", padx=5, pady=5)
        tb.Label(pv_pm_frame, text="Level:").grid(row=0, column=4, sticky="w", padx=5, pady=5)
        tb.Spinbox(pv_pm_frame, from_=1, to=99, textvariable=self.samurai_level, width=4,
                   command=lambda: self.save_current_samurai()).grid(row=0, column=5, sticky="w", padx=5, pady=5)

        attr_frame = tb.Labelframe(sf, text="Atributos", bootstyle="info")
        attr_frame.pack(fill=tk.X, pady=5)
        row = 0
        for name in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]:
            var = tk.IntVar(value=10)
            tb.Label(attr_frame, text=f"{name}:").grid(row=row, column=0, sticky="w", padx=5, pady=2)
            tb.Spinbox(attr_frame, from_=1, to=99, textvariable=var, width=4,
                       command=lambda n=name, v=var: self.update_samurai_attribute(n, v.get())).grid(row=row, column=1, sticky="w", padx=5, pady=2)
            self.samurai_attrs[name] = var
            row += 1

        # Skills
        skills_frame = tb.Labelframe(sf, text="Skills", bootstyle="primary")
        skills_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.samurai_skills_listbox = tk.Listbox(skills_frame, height=6)
        self.samurai_skills_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        skill_entry = tb.Entry(skills_frame, width=18)
        skill_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(skills_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_samurai_skill(skill_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(skills_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_samurai_skill).pack(side=tk.LEFT, padx=5)

        # Habilidades Passivas
        passive_frame = tb.Labelframe(sf, text="Habilidades Passivas", bootstyle="info")
        passive_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.samurai_passive_listbox = tk.Listbox(passive_frame, height=6)
        self.samurai_passive_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        passive_entry = tb.Entry(passive_frame, width=18)
        passive_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(passive_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_samurai_passive(passive_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(passive_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_samurai_passive).pack(side=tk.LEFT, padx=5)

        # Inventário
        inv_frame = tb.Labelframe(sf, text="Inventário", bootstyle="success")
        inv_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.samurai_inventory_listbox = tk.Listbox(inv_frame, height=6)
        self.samurai_inventory_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        inv_entry = tb.Entry(inv_frame, width=18)
        inv_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(inv_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_samurai_item(inv_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(inv_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_samurai_item).pack(side=tk.LEFT, padx=5)

        # Itens chave
        key_frame = tb.Labelframe(sf, text="Itens Chave", bootstyle="warning")
        key_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.samurai_key_listbox = tk.Listbox(key_frame, height=6)
        self.samurai_key_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        key_entry = tb.Entry(key_frame, width=18)
        key_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(key_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_samurai_key_item(key_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(key_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_samurai_key_item).pack(side=tk.LEFT, padx=5)
        self.update_samurai_chars_list()

    def update_samurai_chars_list(self):
        self.samurai_chars_combo['values'] = list(self.samurai_data.keys())
        if self.samurai_chars_combo['values']:
            self.samurai_chars_combo.current(0)
            self.load_samurai_character()

    def remove_samurai_skill(self):
        selection = self.samurai_skills_listbox.curselection()
        if selection:
            self.samurai_skills_listbox.delete(selection[0])
            self.save_current_samurai()

    def remove_samurai_passive(self):
        selection = self.samurai_passive_listbox.curselection()
        if selection:
            self.samurai_passive_listbox.delete(selection[0])
            self.save_current_samurai()

    def remove_samurai_item(self):
        selection = self.samurai_inventory_listbox.curselection()
        if selection:
            self.samurai_inventory_listbox.delete(selection[0])
            self.save_current_samurai()

    def remove_samurai_key_item(self):
        selection = self.samurai_key_listbox.curselection()
        if selection:
            self.samurai_key_listbox.delete(selection[0])
            self.save_current_samurai()

    def setup_persona_user_tab(self, parent):
        frame = ScrollableFrame(parent)
        frame.pack(fill=tk.BOTH, expand=True)
        sf = frame.scrollable_frame

        # Initialize attributes first
        self.persona_user_pv = tk.IntVar(value=100)
        self.persona_user_pm = tk.IntVar(value=50)
        self.persona_user_level = tk.IntVar(value=1)
        self.persona_user_attrs = {}
        for name in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]:
            self.persona_user_attrs[name] = tk.IntVar(value=10)
        self.persona_user_personas = []
        self.persona_user_persona_var = tk.StringVar()
        self.persona_user_skills_listbox = tk.Listbox()
        self.persona_user_passive_listbox = tk.Listbox()
        self.persona_user_inventory_listbox = tk.Listbox()
        self.persona_user_key_listbox = tk.Listbox()

        tb.Label(sf, text="Ficha atual:").pack()
        self.persona_user_chars_var = tk.StringVar()
        self.persona_user_chars_combo = ttk.Combobox(sf, textvariable=self.persona_user_chars_var, state="readonly")
        self.persona_user_chars_combo.pack()
        self.persona_user_chars_combo.bind("<<ComboboxSelected>>", self.load_persona_user_character)

        tb.Button(sf, text="Nova Ficha", command=self.new_persona_user_character, bootstyle="success-outline").pack(pady=2)

        # Personas
        persona_frame = tb.Labelframe(sf, text="Personas", bootstyle="warning")
        persona_frame.pack(fill=tk.X, pady=5)
        tb.Label(persona_frame, text="Equipada:").pack(side=tk.LEFT)
        self.persona_user_persona_combo = ttk.Combobox(persona_frame, textvariable=self.persona_user_persona_var, values=self.persona_user_personas, state="readonly", width=20)
        self.persona_user_persona_combo.pack(side=tk.LEFT, padx=5)
        self.persona_user_persona_combo.bind("<<ComboboxSelected>>", lambda e: self.save_current_persona_user())
        persona_entry = tb.Entry(persona_frame, width=18)
        persona_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(persona_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_persona_user_persona(persona_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(persona_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_persona_user_persona).pack(side=tk.LEFT, padx=5)

        # PV/PM
        pv_pm_frame = tb.Labelframe(sf, text="PV / PM", bootstyle="danger")
        pv_pm_frame.pack(fill=tk.X, pady=5)
        tb.Label(pv_pm_frame, text="PV:").pack(side=tk.LEFT)
        tb.Spinbox(pv_pm_frame, from_=0, to=999, textvariable=self.persona_user_pv, width=6,
                   command=lambda: self.save_current_persona_user()).pack(side=tk.LEFT, padx=5)
        tb.Label(pv_pm_frame, text="PM:").pack(side=tk.LEFT)
        tb.Spinbox(pv_pm_frame, from_=0, to=999, textvariable=self.persona_user_pm, width=6,
                   command=lambda: self.save_current_persona_user()).pack(side=tk.LEFT, padx=5)
        tb.Label(pv_pm_frame, text="Level:").pack(side=tk.LEFT)
        tb.Spinbox(pv_pm_frame, from_=1, to=99, textvariable=self.persona_user_level, width=4,
                   command=lambda: self.save_current_persona_user()).pack(side=tk.LEFT, padx=5)

        # Atributos
        attr_frame = tb.Labelframe(sf, text="Atributos", bootstyle="info")
        attr_frame.pack(fill=tk.X, pady=5)
        for name in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]:
            tb.Label(attr_frame, text=f"{name}:").pack(side=tk.LEFT, padx=2)
            tb.Spinbox(attr_frame, from_=1, to=99, textvariable=self.persona_user_attrs[name], width=4,
                       command=lambda n=name, v=self.persona_user_attrs[name]: self.update_persona_user_attribute(n, v.get())).pack(side=tk.LEFT, padx=2)

        # Skills
        skills_frame = tb.Labelframe(sf, text="Skills", bootstyle="primary")
        skills_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.persona_user_skills_listbox = tk.Listbox(skills_frame, height=6)
        self.persona_user_skills_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        controls_frame = tb.Frame(skills_frame)
        controls_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5)
        skill_entry = tb.Entry(controls_frame, width=18)
        skill_entry.pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_persona_user_skill(skill_entry)).pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_persona_user_skill).pack(fill=tk.X, pady=2)

        # Habilidades Passivas
        passive_frame = tb.Labelframe(sf, text="Habilidades Passivas", bootstyle="info")
        passive_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.persona_user_passive_listbox = tk.Listbox(passive_frame, height=6)
        self.persona_user_passive_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        controls_frame = tb.Frame(passive_frame)
        controls_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5)
        passive_entry = tb.Entry(controls_frame, width=18)
        passive_entry.pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_persona_user_passive(passive_entry)).pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_persona_user_passive).pack(fill=tk.X, pady=2)

        # Inventário
        inv_frame = tb.Labelframe(sf, text="Inventário", bootstyle="success")
        inv_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.persona_user_inventory_listbox = tk.Listbox(inv_frame, height=6)
        self.persona_user_inventory_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        controls_frame = tb.Frame(inv_frame)
        controls_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5)
        inv_entry = tb.Entry(controls_frame, width=18)
        inv_entry.pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_persona_user_item(inv_entry)).pack(fill=tk.X, pady=2)
        tb.Button(controls_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_persona_user_item).pack(fill=tk.X, pady=2)

        # Itens chave
        key_frame = tb.Labelframe(sf, text="Itens Chave", bootstyle="warning")
        key_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.persona_user_key_listbox = tk.Listbox(key_frame, height=6)
        self.persona_user_key_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        key_entry = tb.Entry(key_frame, width=18)
        key_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(key_frame, text="Adicionar", bootstyle="success-outline",
                  command=lambda: self.add_persona_user_key_item(key_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(key_frame, text="Remover", bootstyle="danger-outline",
                  command=self.remove_persona_user_key_item).pack(side=tk.LEFT, padx=5)
        self.update_persona_user_chars_list()

    def update_persona_user_chars_list(self):
        self.persona_user_chars_combo['values'] = list(self.persona_user_data.keys())
        if self.persona_user_chars_combo['values']:
            self.persona_user_chars_combo.current(0)
            self.load_persona_user_character()

    def new_persona_user_character(self):
        name = simpledialog.askstring("Nova Ficha Persona-User", "Nome da nova ficha:")
        if name and name.strip():
            if name in self.persona_user_data:
                messagebox.showerror("Erro", "Já existe uma ficha com este nome!")
                return
            self.persona_user_data[name] = {
                'pv': 100,
                'pm': 50,
                'level': 1,
                'attributes': {k: 10 for k in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]},
                'personas': [],
                'persona_equipped': "",
                'skills': [],
                'passives': [],
                'inventory': [],
                'key_items': []
            }
            self.save_character_data()
            self.update_persona_user_chars_list()
            self.persona_user_chars_combo.set(name)
            self.load_persona_user_character()
            messagebox.showinfo("Sucesso", f"Ficha '{name}' criada e salva!")

    def load_persona_user_character(self, event=None):
        name = self.persona_user_chars_combo.get()
        if name in self.persona_user_data:
            data = self.persona_user_data[name]
            self.persona_user_pv.set(data.get('pv', 100))
            self.persona_user_pm.set(data.get('pm', 50))
            self.persona_user_level.set(data.get('level', 1))

            for attr in self.persona_user_attrs:
                self.persona_user_attrs[attr].set(data['attributes'].get(attr, 10))

            self.persona_user_personas = data.get('personas', [])
            self.persona_user_persona_combo['values'] = self.persona_user_personas
            self.persona_user_persona_var.set(data.get('persona_equipped', ''))

            self.persona_user_skills_listbox.delete(0, tk.END)
            for skill in data['skills']:
                self.persona_user_skills_listbox.insert(tk.END, skill)

            self.persona_user_passive_listbox.delete(0, tk.END)
            for passive in data['passives']:
                self.persona_user_passive_listbox.insert(tk.END, passive)

            self.persona_user_inventory_listbox.delete(0, tk.END)
            for item in data['inventory']:
                self.persona_user_inventory_listbox.insert(tk.END, item)

            self.persona_user_key_listbox.delete(0, tk.END)
            for key_item in data['key_items']:
                self.persona_user_key_listbox.insert(tk.END, key_item)

    def save_current_persona_user(self):
        name = self.persona_user_chars_combo.get()
        if name in self.persona_user_data:
            self.persona_user_data[name]['pv'] = self.persona_user_pv.get()
            self.persona_user_data[name]['pm'] = self.persona_user_pm.get()
            self.persona_user_data[name]['level'] = self.persona_user_level.get()
            self.persona_user_data[name]['attributes'] = {attr: self.persona_user_attrs[attr].get() for attr in self.persona_user_attrs}
            self.persona_user_data[name]['personas'] = self.persona_user_personas
            self.persona_user_data[name]['persona_equipped'] = self.persona_user_persona_var.get()
            self.persona_user_data[name]['skills'] = list(self.persona_user_skills_listbox.get(0, tk.END))
            self.persona_user_data[name]['passives'] = list(self.persona_user_passive_listbox.get(0, tk.END))
            self.persona_user_data[name]['inventory'] = list(self.persona_user_inventory_listbox.get(0, tk.END))
            self.persona_user_data[name]['key_items'] = list(self.persona_user_key_listbox.get(0, tk.END))
            self.save_character_data()

    def update_persona_user_attribute(self, attr, value):
        name = self.persona_user_chars_combo.get()
        if name in self.persona_user_data:
            self.persona_user_data[name]['attributes'][attr] = value
            self.save_character_data()

    def add_persona_user_persona(self, entry):
        name = entry.get().strip()
        if name and name not in self.persona_user_personas:
            self.persona_user_personas.append(name)
            self.persona_user_persona_combo['values'] = self.persona_user_personas
            entry.delete(0, tk.END)
            self.save_current_persona_user()

    def add_persona_user_skill(self, entry):
        skill = entry.get().strip()
        if skill:
            self.persona_user_skills_listbox.insert(tk.END, skill)
            entry.delete(0, tk.END)
            self.save_current_persona_user()

    def add_persona_user_passive(self, entry):
        passive = entry.get().strip()
        if passive:
            self.persona_user_passive_listbox.insert(tk.END, passive)
            entry.delete(0, tk.END)
            self.save_current_persona_user()

    def add_persona_user_item(self, entry):
        item = entry.get().strip()
        if item:
            self.persona_user_inventory_listbox.insert(tk.END, item)
            entry.delete(0, tk.END)
            self.save_current_persona_user()

    def add_persona_user_key_item(self, entry):
        key_item = entry.get().strip()
        if key_item:
            self.persona_user_key_listbox.insert(tk.END, key_item)
            entry.delete(0, tk.END)
            self.save_current_persona_user()

    def remove_persona_user_skill(self):
        selection = self.persona_user_skills_listbox.curselection()
        if selection:
            self.persona_user_skills_listbox.delete(selection[0])
            self.save_current_persona_user()

    def remove_persona_user_passive(self):
        selection = self.persona_user_passive_listbox.curselection()
        if selection:
            self.persona_user_passive_listbox.delete(selection[0])
            self.save_current_persona_user()

    def remove_persona_user_item(self):
        selection = self.persona_user_inventory_listbox.curselection()
        if selection:
            self.persona_user_inventory_listbox.delete(selection[0])
            self.save_current_persona_user()

    def remove_persona_user_key_item(self):
        selection = self.persona_user_key_listbox.curselection()
        if selection:
            self.persona_user_key_listbox.delete(selection[0])
            self.save_current_persona_user()

    def remove_persona_user_persona(self):
        selected = self.persona_user_persona_var.get()
        if selected and selected in self.persona_user_personas:
            self.persona_user_personas.remove(selected)
            self.persona_user_persona_combo['values'] = self.persona_user_personas
            if self.persona_user_personas:
                self.persona_user_persona_var.set(self.persona_user_personas[0])
            else:
                self.persona_user_persona_var.set("")
            self.save_current_persona_user()

    def new_samurai_character(self):
        name = simpledialog.askstring("Nova Ficha Samurai", "Nome da nova ficha:")
        if name and name.strip():
            if name in self.samurai_data:
                messagebox.showerror("Erro", "Já existe uma ficha com este nome!")
                return
            self.samurai_data[name] = {
                'pv': 100,
                'pm': 50,
                'level': 1,
                'attributes': {k: 10 for k in ["Força", "Vitalidade", "Magia", "Agilidade", "Sorte"]},
                'skills': [],
                'passives': [],
                'inventory': [],
                'key_items': []
            }
            self.save_character_data()
            self.update_samurai_chars_list()
            self.samurai_chars_combo.set(name)
            self.load_samurai_character()
            messagebox.showinfo("Sucesso", f"Ficha '{name}' criada e salva!")

    def load_samurai_character(self, event=None):
        name = self.samurai_chars_combo.get()
        if name in self.samurai_data:
            data = self.samurai_data[name]
            self.samurai_pv.set(data['pv'])
            self.samurai_pm.set(data['pm'])
            self.samurai_level.set(data.get('level', 1))
            for attr in self.samurai_attrs:
                self.samurai_attrs[attr].set(data['attributes'].get(attr, 10))
            self.samurai_skills_listbox.delete(0, tk.END)
            for skill in data['skills']:
                self.samurai_skills_listbox.insert(tk.END, skill)
            self.samurai_passive_listbox.delete(0, tk.END)
            for passive in data['passives']:
                self.samurai_passive_listbox.insert(tk.END, passive)
            self.samurai_inventory_listbox.delete(0, tk.END)
            for item in data['inventory']:
                self.samurai_inventory_listbox.insert(tk.END, item)
            self.samurai_key_listbox.delete(0, tk.END)
            for key_item in data['key_items']:
                self.samurai_key_listbox.insert(tk.END, key_item)

    def save_current_samurai(self):
        name = self.samurai_chars_combo.get()
        if name in self.samurai_data:
            self.samurai_data[name]['pv'] = self.samurai_pv.get()
            self.samurai_data[name]['pm'] = self.samurai_pm.get()
            self.samurai_data[name]['level'] = self.samurai_level.get()
            self.samurai_data[name]['attributes'] = {attr: self.samurai_attrs[attr].get() for attr in self.samurai_attrs}
            self.samurai_data[name]['skills'] = list(self.samurai_skills_listbox.get(0, tk.END))
            self.samurai_data[name]['passives'] = list(self.samurai_passive_listbox.get(0, tk.END))
            self.samurai_data[name]['inventory'] = list(self.samurai_inventory_listbox.get(0, tk.END))
            self.samurai_data[name]['key_items'] = list(self.samurai_key_listbox.get(0, tk.END))
            self.save_character_data()

    def update_samurai_attribute(self, attr, value):
        name = self.samurai_chars_combo.get()
        if name in self.samurai_data:
            self.samurai_data[name]['attributes'][attr] = value
            self.save_character_data()

    def add_samurai_skill(self, entry):
        skill = entry.get().strip()
        if skill:
            self.samurai_skills_listbox.insert(tk.END, skill)
            entry.delete(0, tk.END)
            self.save_current_samurai()

    def add_samurai_passive(self, entry):
        passive = entry.get().strip()
        if passive:
            self.samurai_passive_listbox.insert(tk.END, passive)
            entry.delete(0, tk.END)
            self.save_current_samurai()

    def add_samurai_item(self, entry):
        item = entry.get().strip()
        if item:
            self.samurai_inventory_listbox.insert(tk.END, item)
            entry.delete(0, tk.END)
            self.save_current_samurai()

    def add_samurai_key_item(self, entry):
        key_item = entry.get().strip()
        if key_item:
            self.samurai_key_listbox.insert(tk.END, key_item)
            entry.delete(0, tk.END)
            self.save_current_samurai()

    # --- CYBERPUNK COM SCROLL ---
    def setup_cyberpunk_tab(self, parent):
        frame = ScrollableFrame(parent)
        frame.pack(fill=tk.BOTH, expand=True)
        sf = frame.scrollable_frame

        # Initialize variables
        self.cyberpunk_level = tk.IntVar(value=1)
        self.cyberpunk_humanity = tk.IntVar(value=100)

        chars_frame = tb.Labelframe(sf, text="Gerenciamento de Fichas", bootstyle="info")
        chars_frame.pack(fill=tk.X, pady=5)
        chars_control_frame = tb.Frame(chars_frame)
        chars_control_frame.pack(fill=tk.X, pady=5)
        tb.Label(chars_control_frame, text="Ficha atual:").pack(side=tk.LEFT)
        self.cyberpunk_chars = tk.StringVar()
        self.cyberpunk_chars_combo = ttk.Combobox(chars_control_frame, textvariable=self.cyberpunk_chars, state="readonly")
        self.cyberpunk_chars_combo.pack(side=tk.LEFT, padx=5)
        self.cyberpunk_chars_combo.bind("<<ComboboxSelected>>", self.load_cyberpunk_character)
        tb.Button(chars_control_frame, text="Nova Ficha", command=self.new_cyberpunk_character, bootstyle="success-outline").pack(side=tk.LEFT, padx=2)
        tb.Button(chars_control_frame, text="Renomear", command=self.rename_cyberpunk_character, bootstyle="info-outline").pack(side=tk.LEFT, padx=2)
        tb.Button(chars_control_frame, text="Excluir", command=self.delete_cyberpunk_character, bootstyle="danger-outline").pack(side=tk.LEFT, padx=2)

        attributes_frame = tb.Labelframe(sf, text="Atributos", bootstyle="info")
        attributes_frame.pack(fill=tk.X, pady=5)
        self.cyberpunk_attrs = {}
        self.cyberpunk_mods = {}
        attributes = [
            ("Força", "forca", 5, -2),
            ("Destreza", "dex", 22, 6),
            ("Constituição", "con", 9, 1),
            ("Sabedoria", "sab", 10, 1),
            ("Inteligência", "int", 11, 2),
            ("Tecnologia", "tech", 10, 1),
            ("Carisma", "car", 4, -3)
        ]
        for name, key, default_val, default_mod in attributes:
            attr_frame = tb.Frame(attributes_frame)
            attr_frame.pack(fill=tk.X, pady=2)
            tb.Label(attr_frame, text=f"{name}:").pack(side=tk.LEFT)
            attr_var = tk.IntVar(value=default_val)
            tb.Spinbox(attr_frame, from_=1, to=30, textvariable=attr_var, width=5,
                       command=lambda k=key, v=attr_var: self.update_cyberpunk_attribute(k, v.get())).pack(side=tk.LEFT, padx=2)
            self.cyberpunk_attrs[key] = attr_var
            tb.Label(attr_frame, text="(").pack(side=tk.LEFT)
            mod_var = tk.IntVar(value=default_mod)
            tb.Spinbox(attr_frame, from_=-10, to=10, textvariable=mod_var, width=3,
                       command=lambda k=key, v=mod_var: self.update_cyberpunk_modifier(k, v.get())).pack(side=tk.LEFT)
            self.cyberpunk_mods[key] = mod_var
            tb.Label(attr_frame, text=")").pack(side=tk.LEFT)

        life_frame = tb.Labelframe(sf, text="Vida / Humanidade / Dinheiro", bootstyle="danger")
        life_frame.pack(fill=tk.X, pady=5)
        tb.Label(life_frame, text="Vida Atual:").pack(side=tk.LEFT)
        self.cyberpunk_life = tk.IntVar(value=50)
        tb.Spinbox(life_frame, from_=0, to=100, textvariable=self.cyberpunk_life, width=5,
                   command=lambda: self.update_cyberpunk_life()).pack(side=tk.LEFT, padx=5)
        tb.Label(life_frame, text="Vida Máxima:").pack(side=tk.LEFT)
        self.cyberpunk_max_life = tk.IntVar(value=50)
        tb.Spinbox(life_frame, from_=1, to=100, textvariable=self.cyberpunk_max_life, width=5,
                   command=lambda: self.update_cyberpunk_max_life()).pack(side=tk.LEFT, padx=5)
        tb.Label(life_frame, text="Humanidade:").pack(side=tk.LEFT)
        self.cyberpunk_humanity = tk.IntVar(value=100)
        tb.Spinbox(life_frame, from_=0, to=100, textvariable=self.cyberpunk_humanity, width=5,
                   command=lambda: self.update_cyberpunk_humanity()).pack(side=tk.LEFT, padx=5)
        tb.Label(life_frame, text="Dinheiro:").pack(side=tk.LEFT)
        self.cyberpunk_money = tk.IntVar(value=1000)
        tb.Spinbox(life_frame, from_=0, to=100000, textvariable=self.cyberpunk_money, width=8,
                   command=lambda: self.update_cyberpunk_money()).pack(side=tk.LEFT, padx=5)
        tb.Label(life_frame, text="Level:").pack(side=tk.LEFT)
        tb.Spinbox(life_frame, from_=1, to=99, textvariable=self.cyberpunk_level, width=4,
                   command=lambda: self.update_cyberpunk_level()).pack(side=tk.LEFT, padx=5)

        cyberware_frame = tb.Labelframe(sf, text="Próteses e Implantes", bootstyle="warning")
        cyberware_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        cyberware_control_frame = tb.Frame(cyberware_frame)
        cyberware_control_frame.pack(fill=tk.X, pady=5)
        tb.Label(cyberware_control_frame, text="Nova prótese:").pack(side=tk.LEFT)
        self.new_cyberware = tk.StringVar()
        cyberware_entry = tb.Entry(cyberware_control_frame, textvariable=self.new_cyberware)
        cyberware_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        tb.Button(cyberware_control_frame, text="Adicionar", command=self.add_cyberware, bootstyle="success-outline").pack(side=tk.LEFT, padx=5)
        tb.Button(cyberware_control_frame, text="Remover", command=self.remove_cyberware, bootstyle="danger-outline").pack(side=tk.LEFT, padx=5)
        cyberware_list_frame = tb.Frame(cyberware_frame)
        cyberware_list_frame.pack(fill=tk.BOTH, expand=True)
        self.cyberware_listbox = tk.Listbox(cyberware_list_frame, height=6)
        self.cyberware_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        inventory_frame = tb.Labelframe(sf, text="Inventário", bootstyle="primary")
        inventory_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        inventory_control_frame = tb.Frame(inventory_frame)
        inventory_control_frame.pack(fill=tk.X, pady=5)
        tb.Label(inventory_control_frame, text="Novo item:").pack(side=tk.LEFT)
        self.new_inventory_item = tk.StringVar()
        inventory_entry = tb.Entry(inventory_control_frame, textvariable=self.new_inventory_item)
        inventory_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        tb.Button(inventory_control_frame, text="Adicionar", command=self.add_inventory_item, bootstyle="success-outline").pack(side=tk.LEFT, padx=5)
        tb.Button(inventory_control_frame, text="Remover", command=self.remove_inventory_item, bootstyle="danger-outline").pack(side=tk.LEFT, padx=5)
        inventory_list_frame = tb.Frame(inventory_frame)
        inventory_list_frame.pack(fill=tk.BOTH, expand=True)
        self.inventory_listbox = tk.Listbox(inventory_list_frame, height=6)
        self.inventory_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.update_cyberpunk_chars_list()

    # Missing Cyberpunk methods
    def update_cyberpunk_chars_list(self):
        self.cyberpunk_chars_combo['values'] = list(self.cyberpunk_data.keys())
        if self.cyberpunk_chars_combo['values']:
            self.cyberpunk_chars_combo.current(0)
            self.load_cyberpunk_character()

    def new_cyberpunk_character(self):
        name = simpledialog.askstring("Nova Ficha Cyberpunk", "Nome da nova ficha:")
        if name and name.strip():
            if name in self.cyberpunk_data:
                messagebox.showerror("Erro", "Já existe uma ficha com este nome!")
                return
            self.cyberpunk_data[name] = {
                'attributes': {'forca': 5, 'dex': 22, 'con': 9, 'sab': 10, 'int': 11, 'tech': 10, 'car': 4},
                'modifiers': {'forca': -2, 'dex': 6, 'con': 1, 'sab': 1, 'int': 2, 'tech': 1, 'car': -3},
                'life': 50,
                'max_life': 50,
                'humanity': 100,
                'money': 1000,
                'level': 1,
                'cyberware': [],
                'inventory': []
            }
            self.save_character_data()
            self.update_cyberpunk_chars_list()
            self.cyberpunk_chars.set(name)
            self.load_cyberpunk_character()
            messagebox.showinfo("Sucesso", f"Ficha '{name}' criada e salva!")

    def load_cyberpunk_character(self, event=None):
        name = self.cyberpunk_chars.get()
        if name in self.cyberpunk_data:
            data = self.cyberpunk_data[name]
            for attr in self.cyberpunk_attrs:
                self.cyberpunk_attrs[attr].set(data['attributes'].get(attr, 5))
            for mod in self.cyberpunk_mods:
                self.cyberpunk_mods[mod].set(data['modifiers'].get(mod, 0))
            self.cyberpunk_life.set(data.get('life', 50))
            self.cyberpunk_max_life.set(data.get('max_life', 50))
            self.cyberpunk_humanity.set(data.get('humanity', 100))
            self.cyberpunk_money.set(data.get('money', 1000))
            self.cyberpunk_level.set(data.get('level', 1))
            self.cyberware_listbox.delete(0, tk.END)
            for item in data['cyberware']:
                self.cyberware_listbox.insert(tk.END, item)
            self.inventory_listbox.delete(0, tk.END)
            for item in data['inventory']:
                self.inventory_listbox.insert(tk.END, item)

    def rename_cyberpunk_character(self):
        current_name = self.cyberpunk_chars.get()
        if not current_name:
            messagebox.showerror("Erro", "Nenhuma ficha selecionada!")
            return
        new_name = simpledialog.askstring("Renomear Ficha", f"Novo nome para '{current_name}':")
        if new_name and new_name.strip() and new_name != current_name:
            if new_name in self.cyberpunk_data:
                messagebox.showerror("Erro", "Já existe uma ficha com este nome!")
                return
            self.cyberpunk_data[new_name] = self.cyberpunk_data.pop(current_name)
            self.save_character_data()
            self.update_cyberpunk_chars_list()
            self.cyberpunk_chars.set(new_name)
            messagebox.showinfo("Sucesso", f"Ficha renomeada para '{new_name}'!")

    def delete_cyberpunk_character(self):
        current_name = self.cyberpunk_chars.get()
        if not current_name:
            messagebox.showerror("Erro", "Nenhuma ficha selecionada!")
            return
        if messagebox.askyesno("Confirmar", f"Deseja excluir a ficha '{current_name}'?"):
            del self.cyberpunk_data[current_name]
            self.save_character_data()
            self.update_cyberpunk_chars_list()
            messagebox.showinfo("Sucesso", f"Ficha '{current_name}' excluída!")

    def update_cyberpunk_attribute(self, attr, value):
        name = self.cyberpunk_chars.get()
        if name in self.cyberpunk_data:
            self.cyberpunk_data[name]['attributes'][attr] = value
            self.save_character_data()

    def update_cyberpunk_modifier(self, attr, value):
        name = self.cyberpunk_chars.get()
        if name in self.cyberpunk_data:
            self.cyberpunk_data[name]['modifiers'][attr] = value
            self.save_character_data()

    def add_cyberware(self):
        item = self.new_cyberware.get().strip()
        if item:
            self.cyberware_listbox.insert(tk.END, item)
            self.new_cyberware.set("")
            name = self.cyberpunk_chars.get()
            if name in self.cyberpunk_data:
                self.cyberpunk_data[name]['cyberware'] = list(self.cyberware_listbox.get(0, tk.END))
            self.save_character_data()

    def remove_cyberware(self):
        selection = self.cyberware_listbox.curselection()
        if selection:
            self.cyberware_listbox.delete(selection[0])
            name = self.cyberpunk_chars.get()
            if name in self.cyberpunk_data:
                self.cyberpunk_data[name]['cyberware'] = list(self.cyberware_listbox.get(0, tk.END))
                self.save_character_data()

    def add_inventory_item(self):
        item = self.new_inventory_item.get().strip()
        if item:
            self.inventory_listbox.insert(tk.END, item)
            self.new_inventory_item.set("")
            name = self.cyberpunk_chars.get()
            if name in self.cyberpunk_data:
                self.cyberpunk_data[name]['inventory'] = list(self.inventory_listbox.get(0, tk.END))
                self.save_character_data()

    def remove_inventory_item(self):
        selection = self.inventory_listbox.curselection()
        if selection:
            self.inventory_listbox.delete(selection[0])
            name = self.cyberpunk_chars.get()
            if name in self.cyberpunk_data:
                self.cyberpunk_data[name]['inventory'] = list(self.inventory_listbox.get(0, tk.END))
                self.save_character_data()

    def update_cyberpunk_life(self):
        name = self.cyberpunk_chars.get()
        if name in self.cyberpunk_data:
            self.cyberpunk_data[name]['life'] = self.cyberpunk_life.get()
            self.save_character_data()

    def update_cyberpunk_max_life(self):
        name = self.cyberpunk_chars.get()
        if name in self.cyberpunk_data:
            self.cyberpunk_data[name]['max_life'] = self.cyberpunk_max_life.get()
            self.save_character_data()

    def update_cyberpunk_humanity(self):
        name = self.cyberpunk_chars.get()
        if name in self.cyberpunk_data:
            self.cyberpunk_data[name]['humanity'] = self.cyberpunk_humanity.get()
            self.save_character_data()

    def update_cyberpunk_money(self):
        name = self.cyberpunk_chars.get()
        if name in self.cyberpunk_data:
            self.cyberpunk_data[name]['money'] = self.cyberpunk_money.get()
            self.save_character_data()

    def update_cyberpunk_level(self):
        name = self.cyberpunk_chars.get()
        if name in self.cyberpunk_data:
            self.cyberpunk_data[name]['level'] = self.cyberpunk_level.get()
            self.save_character_data()

    # --- WARHAMMER COM SCROLL ---
    def setup_warhammer_tab(self, parent):
        frame = ScrollableFrame(parent)
        frame.pack(fill=tk.BOTH, expand=True)
        sf = frame.scrollable_frame

        chars_frame = tb.Labelframe(sf, text="Gerenciamento de Fichas", bootstyle="info")
        chars_frame.pack(fill=tk.X, pady=5)
        chars_control_frame = tb.Frame(chars_frame)
        chars_control_frame.pack(fill=tk.X, pady=5)
        tb.Label(chars_control_frame, text="Ficha atual:").pack(side=tk.LEFT)
        self.warhammer_chars_var = tk.StringVar()
        self.warhammer_chars_combo = ttk.Combobox(chars_control_frame, textvariable=self.warhammer_chars_var, state="readonly")
        self.warhammer_chars_combo.pack(side=tk.LEFT, padx=5)
        self.warhammer_chars_combo.bind("<<ComboboxSelected>>", self.load_warhammer_character)
        tb.Button(chars_control_frame, text="Nova Ficha", command=self.new_warhammer_character, bootstyle="success-outline").pack(side=tk.LEFT, padx=2)
        tb.Button(chars_control_frame, text="Renomear", command=self.rename_warhammer_character, bootstyle="info-outline").pack(side=tk.LEFT, padx=2)
        tb.Button(chars_control_frame, text="Excluir", command=self.delete_warhammer_character, bootstyle="danger-outline").pack(side=tk.LEFT, padx=2)

        attributes_frame = tb.Labelframe(sf, text="Atributos", bootstyle="info")
        attributes_frame.pack(fill=tk.X, pady=5)
        self.warhammer_attrs = {}
        attributes = [
            ("Movimento", "mov", 4),
            ("Habilidade com Arma", "hab_arma", 30),
            ("Precisão de Tiro", "prec_tiro", 30),
            ("Força", "forca", 3),
            ("Resiliência", "res", 3),
            ("Ferimentos", "fer", 1),
            ("Iniciativa", "ini", 30),
            ("Ataques", "ataq", 1),
            ("Liderança", "lid", 6)
        ]
        for name, key, default_val in attributes:
            attr_frame = tb.Frame(attributes_frame)
            attr_frame.pack(fill=tk.X, pady=2)
            tb.Label(attr_frame, text=f"{name}:").pack(side=tk.LEFT)
            var = tk.IntVar(value=default_val)
            tb.Spinbox(attr_frame, from_=1, to=100, textvariable=var, width=5,
                       command=lambda k=key, v=var: self.update_warhammer_attribute(k, v.get())).pack(side=tk.LEFT, padx=2)
            self.warhammer_attrs[key] = var

        life_frame = tb.Labelframe(sf, text="Vida do Personagem", bootstyle="danger")
        life_frame.pack(fill=tk.X, pady=5)
        tb.Label(life_frame, text="Vida Atual:").pack(side=tk.LEFT)
        self.warhammer_current_life = tk.IntVar(value=10)
        tb.Spinbox(life_frame, from_=0, to=100, textvariable=self.warhammer_current_life, width=5,
                   command=lambda: self.update_warhammer_current_life()).pack(side=tk.LEFT, padx=5)
        tb.Label(life_frame, text="Vida Máxima:").pack(side=tk.LEFT)
        self.warhammer_max_life = tk.IntVar(value=10)
        tb.Spinbox(life_frame, from_=1, to=100, textvariable=self.warhammer_max_life, width=5,
                   command=lambda: self.update_warhammer_max_life()).pack(side=tk.LEFT, padx=5)
        self.warhammer_level = tk.IntVar(value=1)
        tb.Label(life_frame, text="Level:").pack(side=tk.LEFT)
        tb.Spinbox(life_frame, from_=1, to=99, textvariable=self.warhammer_level, width=4,
                   command=lambda: self.update_warhammer_level()).pack(side=tk.LEFT, padx=5)

        skills_frame = tb.Labelframe(sf, text="Perícias (Marque até 4)", bootstyle="primary")
        skills_frame.pack(fill=tk.X, pady=5)
        skills = [
            "Lógica", "Carisma", "Conhecimento", "Medicina", 
            "Pilotagem", "Explosivos", "Intimidar", "Procurar", "Tecnologia"
        ]
        self.warhammer_skills_vars = {}
        for skill in skills:
            var = tk.BooleanVar(value=False)
            cb = tb.Checkbutton(skills_frame, text=skill, variable=var,
                           bootstyle="primary-square-toggle",
                           command=lambda s=skill, v=var: self.update_warhammer_skill(s, v.get()))
            cb.pack(anchor="w", pady=2)
            self.warhammer_skills_vars[skill] = var

        armor_frame = tb.Labelframe(sf, text="Armaduras", bootstyle="warning")
        armor_frame.pack(fill=tk.X, pady=5)
        armors = [
            ("Couro", 1),
            ("Couro Reforçado", 2),
            ("Cota de Malha", 3),
            ("Placas", 4)
        ]
        self.warhammer_armor_var = tk.StringVar(value="Couro")
        for armor, value in armors:
            tb.Radiobutton(armor_frame, text=f"{armor} (Proteção: {value})",
                       variable=self.warhammer_armor_var, value=armor,
                       bootstyle="info-round-toggle",
                       command=lambda: self.save_character_data()).pack(anchor="w", pady=1)

        weapons_frame = tb.Labelframe(sf, text="Armas", bootstyle="danger")
        weapons_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.weapons_listbox = tk.Listbox(weapons_frame, height=6)
        self.weapons_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        weapon_entry = tb.Entry(weapons_frame, width=18)
        weapon_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(weapons_frame, text="Adicionar", bootstyle="success-outline",
              command=lambda: self.add_weapon(weapon_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(weapons_frame, text="Remover", bootstyle="danger-outline",
              command=self.remove_weapon).pack(side=tk.LEFT, padx=5)

        equipment_frame = tb.Labelframe(sf, text="Equipamentos", bootstyle="success")
        equipment_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.equipment_listbox = tk.Listbox(equipment_frame, height=6)
        self.equipment_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        equipment_entry = tb.Entry(equipment_frame, width=18)
        equipment_entry.pack(side=tk.LEFT, padx=5)
        tb.Button(equipment_frame, text="Adicionar", bootstyle="success-outline",
              command=lambda: self.add_equipment(equipment_entry)).pack(side=tk.LEFT, padx=5)
        tb.Button(equipment_frame, text="Remover", bootstyle="danger-outline",
              command=self.remove_equipment).pack(side=tk.LEFT, padx=5)

        notes_frame = tb.Labelframe(sf, text="Observações", bootstyle="secondary")
        notes_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        self.warhammer_notes = tk.Text(notes_frame, height=6)
        self.warhammer_notes.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        tb.Button(notes_frame, text="Salvar Observações", command=self.save_notes, bootstyle="primary-outline").pack(pady=5)

        self.update_warhammer_chars_list()
        if self.warhammer_chars_combo['values']:
            self.warhammer_chars_combo.current(0)
            self.load_warhammer_character()

    # Missing Warhammer methods
    def update_warhammer_chars_list(self):
        self.warhammer_chars_combo['values'] = list(self.warhammer_data.keys())
        if self.warhammer_chars_combo['values']:
            self.warhammer_chars_var.set(self.warhammer_chars_combo['values'][0])
            self.load_warhammer_character()

    def new_warhammer_character(self):
        name = simpledialog.askstring("Nova Ficha Warhammer", "Nome da nova ficha:")
        if name and name.strip():
            if name in self.warhammer_data:
                messagebox.showerror("Erro", "Já existe uma ficha com este nome!")
                return
            self.warhammer_data[name] = {
                'attributes': {'mov': 4, 'hab_arma': 30, 'prec_tiro': 30, 'forca': 3, 'res': 3, 'fer': 1, 'ini': 30, 'ataq': 1, 'lid': 6},
                'current_life': 10,
                'max_life': 10,
                'level': 1,
                'skills': {skill: False for skill in ["Lógica", "Carisma", "Conhecimento", "Medicina", "Pilotagem", "Explosivos", "Intimidar", "Procurar", "Tecnologia"]},
                'armor': "Couro",
                'weapons': [],
                'equipment': [],
                'notes': ""
            }
            self.save_character_data()
            self.update_warhammer_chars_list()
            self.warhammer_chars_var.set(name)
            self.load_warhammer_character()
            messagebox.showinfo("Sucesso", f"Ficha '{name}' criada e salva!")

    def load_warhammer_character(self, event=None):
        name = self.warhammer_chars_var.get()
        if name in self.warhammer_data:
            data = self.warhammer_data[name]
            for attr in self.warhammer_attrs:
                self.warhammer_attrs[attr].set(data['attributes'].get(attr, 0))
            self.warhammer_current_life.set(data.get('current_life', 10))
            self.warhammer_max_life.set(data.get('max_life', 10))
            self.warhammer_level.set(data.get('level', 1))
            for skill in self.warhammer_skills_vars:
                self.warhammer_skills_vars[skill].set(data['skills'].get(skill, False))
            self.warhammer_armor_var.set(data.get('armor', 'Couro'))
            self.weapons_listbox.delete(0, tk.END)
            weapons = data.get('weapons', [])
            for weapon in weapons:
                self.weapons_listbox.insert(tk.END, weapon)
            self.equipment_listbox.delete(0, tk.END)
            equipment = data.get('equipment', [])
            for eq in equipment:
                self.equipment_listbox.insert(tk.END, eq)
            self.warhammer_notes.delete(1.0, tk.END)
            notes = data.get('notes', '')
            self.warhammer_notes.insert(1.0, notes)

    def rename_warhammer_character(self):
        current_name = self.warhammer_chars_var.get()
        if not current_name:
            messagebox.showerror("Erro", "Nenhuma ficha selecionada!")
            return
        new_name = simpledialog.askstring("Renomear Ficha", f"Novo nome para '{current_name}':")
        if new_name and new_name.strip() and new_name != current_name:
            if new_name in self.warhammer_data:
                messagebox.showerror("Erro", "Já existe uma ficha com este nome!")
                return
            self.warhammer_data[new_name] = self.warhammer_data.pop(current_name)
            self.save_character_data()
            self.update_warhammer_chars_list()
            self.warhammer_chars_var.set(new_name)
            messagebox.showinfo("Sucesso", f"Ficha renomeada para '{new_name}'!")

    def delete_warhammer_character(self):
        current_name = self.warhammer_chars_var.get()
        if not current_name:
            messagebox.showerror("Erro", "Nenhuma ficha selecionada!")
            return
        if messagebox.askyesno("Confirmar", f"Deseja excluir a ficha '{current_name}'?"):
            del self.warhammer_data[current_name]
            self.save_character_data()
            self.update_warhammer_chars_list()
            messagebox.showinfo("Sucesso", f"Ficha '{current_name}' excluída!")

    def update_warhammer_attribute(self, attr, value):
        name = self.warhammer_chars_var.get()
        if name in self.warhammer_data:
            self.warhammer_data[name]['attributes'][attr] = value
            self.save_character_data()

    def update_warhammer_skill(self, skill, value):
        name = self.warhammer_chars_var.get()
        if name in self.warhammer_data:
            self.warhammer_data[name]['skills'][skill] = value
            self.save_character_data()

    def add_weapon(self, entry):
        weapon = entry.get().strip()
        if weapon:
            self.weapons_listbox.insert(tk.END, weapon)
            entry.delete(0, tk.END)
            name = self.warhammer_chars_var.get()
            if name in self.warhammer_data:
                self.warhammer_data[name]['weapons'] = list(self.weapons_listbox.get(0, tk.END))
                self.save_character_data()

    def add_equipment(self, entry):
        equipment = entry.get().strip()
        if equipment:
            self.equipment_listbox.insert(tk.END, equipment)
            entry.delete(0, tk.END)
            name = self.warhammer_chars_var.get()
            if name in self.warhammer_data:
                self.warhammer_data[name]['equipment'] = list(self.equipment_listbox.get(0, tk.END))
                self.save_character_data()

    
    def reroll_dice(self):
        if self.last_roll:
            dice, quantity, modifier, original_mode = self.last_roll
            timestamp = datetime.now().strftime("%H:%M:%S")
            
            mode = "desvantagem"
            
            roll_functions = {
                "d4": self.roll_d4,
                "d6": self.roll_d6,
                "d8": self.roll_d8,
                "d10": self.roll_d10,
                "d12": self.roll_d12,
                "d20": self.roll_d20,
                "d100": self.roll_d100,
                "dpercent": self.roll_dpercent
            }
            
            roll_func = roll_functions[dice]
            is_percent = (dice == "dpercent")
            is_d20 = (dice == "d20")
            
            all_rolls = []
            for _ in range(quantity):
                roll1 = roll_func()
                roll2 = roll_func()
                roll = min(roll1, roll2)
                roll_str = f"{roll1}{'%' if is_percent else ''}/{roll2}{'%' if is_percent else ''}→{roll}{'%' if is_percent else ''}"
                all_rolls.append(roll_str)
            
            critical_text = ""
            if is_d20 and quantity == 1:
                roll_value = int(all_rolls[0].split('→')[-1]) if '→' in all_rolls[0] else int(all_rolls[0])
               
                if roll_value == 20:
                    critical_text = " - 🗿 SUCESSO CRÍTICO!"
                    self.result_label.configure(foreground="#0080ff")
                elif roll_value == 1:
                    critical_text = " - 💀 FALHA CRÍTICA!"
                    self.result_label.configure(foreground="#ff0000")
                else:
                    self.result_label.configure(foreground="black" if not self.is_dark else "white")
            else:
                self.result_label.configure(foreground="black" if not self.is_dark else "white")
            
            if modifier != 0:
                if dice == "d6" and quantity > 1:
                    rolls_values = [int(r.split('→')[-1].replace('%', '')) if '→' in r else int(r.replace('%', '')) for r in all_rolls]
                    total = sum(rolls_values)
                    final = total + modifier
                    result_text = f"Rerol (Desvantagem): {', '.join(all_rolls)} = {total} + {modifier} = {final}{critical_text}"
                else:
                    modified_rolls = []
                    for r in all_rolls:
                        roll_value = int(r.split('→')[-1].replace('%', '')) if '→' in r else int(r.replace('%', ''))
                        modified_value = roll_value + modifier
                        modified_rolls.append(f"{modified_value}{'%' if is_percent else ''}")
                    
                    mod_text = f" {'+' if modifier > 0 else ''}{modifier}{'%' if is_percent else ''} = "
                    result_text = f"Rerol (Desvantagem): {', '.join(all_rolls)}{mod_text}{', '.join(modified_rolls)}{critical_text}"
            else:
                if dice == "d6" and quantity > 1:
                    rolls_values = [int(r.split('→')[-1]) if '→' in r else int(r) for r in all_rolls]
                    total = sum(rolls_values)
                    result_text = f"Rerol (Desvantagem): {', '.join(all_rolls)} = {total}{critical_text}"
                else:
                    result_text = f"Rerol (Desvantagem): {', '.join(all_rolls)}{critical_text}"
            
            history_entry = {
                'timestamp': timestamp,
                'type': f"{dice} x{quantity}",
                'mode': mode,
                'modifier': modifier,
                'rolls': all_rolls,
                'display': result_text
            }
            
            self.history.append(history_entry)
            self.current_result.set(result_text)
    
    def reset_dice(self):
        self.current_result.set("Selecione um dado e clique em Rolar!")
        self.last_roll = None
        self.reroll_button.config(state="disabled")
        self.result_label.configure(foreground="black" if not self.is_dark else "white")
    
    def show_history(self):
        if not self.history:
            messagebox.showinfo("Histórico", "Nenhum lançamento registrado ainda!")
            return
            
        history_window = tb.Toplevel(self.root)
        history_window.title("Histórico de Lançamentos")
        history_window.geometry("700x400")
        
        main_frame = tb.Frame(history_window, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        scrollbar = tb.Scrollbar(main_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        text_color = "black" if not self.is_dark else "white"
        bg_color = "#2b2b2b" if self.is_dark else "#f5f5f5"
        sel_color = "#555555" if self.is_dark else "#cce0ff"
        history_listbox = tk.Listbox(
            main_frame,
            yscrollcommand=scrollbar.set,
            font=('Courier', 10),
            selectmode=tk.SINGLE,
            width=90,
            height=20,
            bg=bg_color,
            fg=text_color,
            selectbackground=sel_color,
            selectforeground=text_color
        )
        history_listbox.pack(fill=tk.BOTH, expand=True)
        
        scrollbar.config(command=history_listbox.yview)
        
        for idx, entry in enumerate(reversed(self.history)):
            display_text = f"[{entry['timestamp']}] {entry['display']}"
            history_listbox.insert(tk.END, display_text)
        
        close_button = tb.Button(
            history_window,
            text="Fechar",
            command=history_window.destroy,
            bootstyle="secondary-outline"
        )
        close_button.pack(pady=10)
    
    def clear_history(self):
        self.history = []
        messagebox.showinfo("Histórico", "Histórico de lançamentos limpo com sucesso!")



    def save_notes(self):
        name = self.warhammer_chars_var.get()
        if name in self.warhammer_data:
            self.warhammer_data[name]['notes'] = self.warhammer_notes.get(1.0, tk.END).strip()
            self.save_character_data()

    def remove_weapon(self):
        selection = self.weapons_listbox.curselection()
        if selection:
            self.weapons_listbox.delete(selection[0])
            name = self.warhammer_chars_var.get()
            if name in self.warhammer_data:
                self.warhammer_data[name]['weapons'] = list(self.weapons_listbox.get(0, tk.END))
                self.save_character_data()

    def remove_equipment(self):
        selection = self.equipment_listbox.curselection()
        if selection:
            self.equipment_listbox.delete(selection[0])
            name = self.warhammer_chars_var.get()
            if name in self.warhammer_data:
                self.warhammer_data[name]['equipment'] = list(self.equipment_listbox.get(0, tk.END))
                self.save_character_data()

    def update_warhammer_current_life(self):
        name = self.warhammer_chars_var.get()
        if name in self.warhammer_data:
            self.warhammer_data[name]['current_life'] = self.warhammer_current_life.get()
            self.save_character_data()

    def update_warhammer_max_life(self):
        name = self.warhammer_chars_var.get()
        if name in self.warhammer_data:
            self.warhammer_data[name]['max_life'] = self.warhammer_max_life.get()
            self.save_character_data()

    def update_warhammer_level(self):
        name = self.warhammer_chars_var.get()
        if name in self.warhammer_data:
            self.warhammer_data[name]['level'] = self.warhammer_level.get()
            self.save_character_data()

    def roll_d4(self):
        return random.randint(1, 4)
    
    def roll_d6(self):
        return random.randint(1, 6)
    
    def roll_d8(self):
        return random.randint(1, 8)
    
    def roll_d10(self):
        return random.randint(1, 10)
    
    def roll_d12(self):
        return random.randint(1, 12)
    
    def roll_d20(self):
        return random.randint(1, 20)
    
    def roll_d100(self):
        return random.randint(1, 100)
    
    def roll_dpercent(self):
        return random.randint(1, 10) * 10
    
    def roll_dice(self):
        modifier = self.modifier.get()
        mode = self.roll_mode.get()
        quantity = self.num_dice.get()
        timestamp = datetime.now().strftime("%H:%M:%S")

        roll_functions = {
            "d4": self.roll_d4,
            "d6": self.roll_d6,
            "d8": self.roll_d8,
            "d10": self.roll_d10,
            "d12": self.roll_d12,
            "d20": self.roll_d20,
            "d100": self.roll_d100,
            "dpercent": self.roll_dpercent
        }

        if self.use_custom.get():
            try:
                sides = int(self.custom_sides.get())
                if sides < 2:
                    raise ValueError
            except (ValueError, tk.TclError):
                messagebox.showerror("Erro", "Informe um número de lados válido (mínimo 2).")
                return
            dice = f"d{sides}"
            roll_func = lambda s=sides: random.randint(1, s)
            is_percent = False
            is_d20 = (sides == 20)
        else:
            dice = self.dice_type.get()
            roll_func = roll_functions[dice]
            is_percent = (dice == "dpercent")
            is_d20 = (dice == "d20")
        
        all_rolls = []
        for _ in range(quantity):
            if mode == "normal":
                roll = roll_func()
                all_rolls.append(str(roll) + ("%" if is_percent else ""))
            else:
                roll1 = roll_func()
                roll2 = roll_func()
                roll = max(roll1, roll2) if mode == "vantagem" else min(roll1, roll2)
                roll_str = f"{roll1}{'%' if is_percent else ''}/{roll2}{'%' if is_percent else ''}→{roll}{'%' if is_percent else ''}"
                all_rolls.append(roll_str)
        
        critical_text = ""
        if is_d20 and quantity == 1:
            roll_value = int(all_rolls[0].split('→')[-1]) if '→' in all_rolls[0] else int(all_rolls[0])
            if roll_value == 20:
                critical_text = " - 🗿 SUCESSO CRÍTICO!"
                self.result_label.configure(foreground="#0080ff")
            elif roll_value == 1:
                critical_text = " - 💀 FALHA CRÍTICA!"
                self.result_label.configure(foreground="#ff0000")
            else:
                self.result_label.configure(foreground="black" if not self.is_dark else "white")
        else:
            self.result_label.configure(foreground="black" if not self.is_dark else "white")
        
        if modifier != 0:
            if dice == "d6" and quantity > 1:
                rolls_values = [int(r.split('→')[-1].replace('%', '')) if '→' in r else int(r.replace('%', '')) for r in all_rolls]
                total = sum(rolls_values)
                final = total + modifier
                result_text = f"Resultado: {', '.join(all_rolls)} = {total} + {modifier} = {final}{critical_text}"
            else:
                modified_rolls = []
                for r in all_rolls:
                    roll_value = int(r.split('→')[-1].replace('%', '')) if '→' in r else int(r.replace('%', ''))
                    modified_value = roll_value + modifier
                    modified_rolls.append(f"{modified_value}{'%' if is_percent else ''}")
                
                mod_text = f" {'+' if modifier > 0 else ''}{modifier}{'%' if is_percent else ''} = "
                result_text = f"Resultados: {', '.join(all_rolls)}{mod_text}{', '.join(modified_rolls)}{critical_text}"
        else:
            if dice == "d6" and quantity > 1:
                rolls_values = [int(r.split('→')[-1]) if '→' in r else int(r) for r in all_rolls]
                total = sum(rolls_values)
                result_text = f"Resultado: {', '.join(all_rolls)} = {total}{critical_text}"
            else:
                result_text = f"Resultados: {', '.join(all_rolls)}{critical_text}"
        
        history_entry = {
            'timestamp': timestamp,
            'type': f"{dice} x{quantity}",
            'mode': mode,
            'modifier': modifier,
            'rolls': all_rolls,
            'display': result_text
        }
        
        self.history.append(history_entry)
        self.last_roll = (dice, quantity, modifier, mode)
        self.current_result.set(result_text)
        self.reroll_button.config(state="normal")
    
if __name__ == "__main__":
    root = tb.Window(themename="darkly")
    app = DiceRollerApp(root)
    root.mainloop()
